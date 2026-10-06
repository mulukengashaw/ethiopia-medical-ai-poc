import argparse
import hashlib
import json
import logging
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance, ImageOps
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset

from xray_model import ChestXrayScreeningModel

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATASET = ROOT / "data" / "raw" / "TB_Chest_Radiography_Database"
DEFAULT_OUTPUT = ROOT / "models" / "tb_screening.pt"
IMAGE_SIZE = 128
SEED = 42


def configure_data_worker(_worker_id):
    torch.set_num_threads(1)


class ChestXrayDataset(Dataset):
    def __init__(self, samples, augment=False):
        self.samples = samples
        self.augment = augment
        self.cached_images = {}

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        image_path, label = self.samples[index]
        if index not in self.cached_images:
            with Image.open(image_path) as source:
                resized = ImageOps.grayscale(source).resize(
                    (IMAGE_SIZE, IMAGE_SIZE),
                    Image.Resampling.BILINEAR,
                )
                self.cached_images[index] = np.asarray(resized, dtype=np.uint8).copy()
        image = Image.fromarray(self.cached_images[index])

        if self.augment:
            if random.random() < 0.5:
                image = image.rotate(random.uniform(-5, 5), resample=Image.Resampling.BILINEAR)
            if random.random() < 0.35:
                image = ImageEnhance.Contrast(image).enhance(random.uniform(0.9, 1.1))
            if random.random() < 0.35:
                image = ImageEnhance.Brightness(image).enhance(random.uniform(0.95, 1.05))

        pixels = np.asarray(image, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(pixels).unsqueeze(0)
        tensor = (tensor - 0.5) / 0.25
        return tensor, torch.tensor(label, dtype=torch.float32)


def collect_samples(dataset_dir):
    class_folders = (("Normal", 0), ("Tuberculosis", 1))
    samples = []
    hashes = set()
    duplicate_count = 0
    class_counts = {"Normal": 0, "Tuberculosis": 0}

    for folder, label in class_folders:
        class_dir = dataset_dir / folder
        if not class_dir.is_dir():
            raise FileNotFoundError(f"Required dataset class folder is missing: {class_dir}")
        for image_path in sorted(class_dir.glob("*.png")):
            digest = hashlib.sha256(image_path.read_bytes()).digest()
            if digest in hashes:
                duplicate_count += 1
                continue
            hashes.add(digest)
            samples.append((image_path, label))
            class_counts[folder] += 1

    if class_counts["Normal"] < 20 or class_counts["Tuberculosis"] < 20:
        raise ValueError(f"Not enough images to split and train safely: {class_counts}")
    if duplicate_count:
        logging.info("Removed %d exact duplicate image files.", duplicate_count)
    return samples, class_counts, duplicate_count


def choose_sensitivity_threshold(labels, scores, target_sensitivity):
    thresholds = sorted(set(scores.tolist()), reverse=True)
    candidates = [1.0 + 1e-7, *thresholds]
    valid = []
    for threshold in candidates:
        predictions = (scores >= threshold).astype(np.int64)
        true_negatives, false_positives, false_negatives, true_positives = confusion_matrix(
            labels,
            predictions,
            labels=[0, 1],
        ).ravel()
        sensitivity = true_positives / max(1, true_positives + false_negatives)
        specificity = true_negatives / max(1, true_negatives + false_positives)
        if sensitivity >= target_sensitivity:
            valid.append((specificity, sensitivity, threshold))
    if not valid:
        return 0.0
    return float(max(valid)[2])


def evaluate(labels, scores, threshold):
    predictions = (scores >= threshold).astype(np.int64)
    true_negatives, false_positives, false_negatives, true_positives = confusion_matrix(
        labels,
        predictions,
        labels=[0, 1],
    ).ravel()
    return {
        "image_count": int(len(labels)),
        "tb_labeled_image_count": int(np.sum(labels == 1)),
        "normal_labeled_image_count": int(np.sum(labels == 0)),
        "threshold": round(float(threshold), 6),
        "accuracy": float(round(float(accuracy_score(labels, predictions)), 4)),
        "roc_auc": float(round(float(roc_auc_score(labels, scores)), 4)),
        "sensitivity": float(
            round(
                float(true_positives / max(1, true_positives + false_negatives)),
                4,
            )
        ),
        "specificity": float(
            round(
                float(true_negatives / max(1, true_negatives + false_positives)),
                4,
            )
        ),
        "true_positives": int(true_positives),
        "false_positives": int(false_positives),
        "true_negatives": int(true_negatives),
        "false_negatives": int(false_negatives),
    }


def predict(model, loader, device):
    model.eval()
    all_scores = []
    all_labels = []
    with torch.inference_mode():
        for images, labels in loader:
            logits = model(images.to(device))
            all_scores.extend(torch.sigmoid(logits).cpu().numpy().tolist())
            all_labels.extend(labels.numpy().astype(np.int64).tolist())
    return np.asarray(all_labels, dtype=np.int64), np.asarray(all_scores, dtype=np.float64)


def train(args):
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(1)

    samples, class_counts, duplicate_count = collect_samples(args.dataset)
    labels = np.asarray([label for _, label in samples], dtype=np.int64)
    train_val, test = train_test_split(
        samples,
        test_size=0.15,
        random_state=SEED,
        stratify=labels,
    )
    train_labels = np.asarray([label for _, label in train_val], dtype=np.int64)
    train, validation = train_test_split(
        train_val,
        test_size=0.1764705882,
        random_state=SEED,
        stratify=train_labels,
    )

    logging.info(
        "Image-level split: train=%d, validation=%d, test=%d; class counts=%s",
        len(train),
        len(validation),
        len(test),
        class_counts,
    )
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logging.info("Training on %s; input size %dx%d.", device, IMAGE_SIZE, IMAGE_SIZE)

    generator = torch.Generator().manual_seed(SEED)
    train_loader = DataLoader(
        ChestXrayDataset(train, augment=True),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
        generator=generator,
        worker_init_fn=configure_data_worker,
        persistent_workers=args.workers > 0,
    )
    validation_loader = DataLoader(
        ChestXrayDataset(validation),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
        worker_init_fn=configure_data_worker,
        persistent_workers=args.workers > 0,
    )
    test_loader = DataLoader(
        ChestXrayDataset(test),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
        worker_init_fn=configure_data_worker,
        persistent_workers=args.workers > 0,
    )

    class_totals = np.bincount([label for _, label in train], minlength=2)
    class_weights = torch.tensor(
        [len(train) / (2 * count) for count in class_totals],
        dtype=torch.float32,
        device=device,
    )
    model = ChestXrayScreeningModel().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    loss_function = nn.BCEWithLogitsLoss()
    best_validation_loss = float("inf")
    best_state = None
    stale_epochs = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        loss_sum = 0.0
        for images, targets in train_loader:
            images = images.to(device)
            targets = targets.to(device)
            sample_weights = torch.where(targets > 0.5, class_weights[1], class_weights[0])
            optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            sample_losses = nn.functional.binary_cross_entropy_with_logits(
                logits,
                targets,
                reduction="none",
            )
            loss = (sample_losses * sample_weights).mean()
            loss.backward()
            optimizer.step()
            loss_sum += loss.item() * len(targets)

        validation_loss = 0.0
        model.eval()
        with torch.inference_mode():
            for images, targets in validation_loader:
                images = images.to(device)
                targets = targets.to(device)
                validation_loss += loss_function(model(images), targets).item() * len(targets)
        validation_loss /= len(validation)
        logging.info(
            "Epoch %d/%d — train loss %.4f, validation loss %.4f",
            epoch,
            args.epochs,
            loss_sum / len(train),
            validation_loss,
        )
        if validation_loss < best_validation_loss:
            best_validation_loss = validation_loss
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.state_dict().items()
            }
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= args.patience:
                logging.info("Early stopping after %d epochs without improvement.", args.patience)
                break

    if best_state is None:
        raise RuntimeError("Training did not produce a usable model checkpoint")

    model.load_state_dict(best_state)
    validation_labels, validation_scores = predict(model, validation_loader, device)
    threshold = choose_sensitivity_threshold(
        validation_labels,
        validation_scores,
        args.target_sensitivity,
    )
    test_labels, test_scores = predict(model, test_loader, device)
    test_metrics = evaluate(test_labels, test_scores, threshold)
    validation_metrics = evaluate(validation_labels, validation_scores, threshold)

    dataset_digest = hashlib.sha256()
    for image_path, label in samples:
        dataset_digest.update(image_path.name.encode("utf-8"))
        dataset_digest.update(bytes([label]))

    artifact = {
        "format_version": 1,
        "architecture": "ChestXrayScreeningModel",
        "input_size": IMAGE_SIZE,
        "class_names": ["Normal-labeled", "TB-labeled"],
        "positive_class_index": 1,
        "threshold": threshold,
        "target_validation_sensitivity": args.target_sensitivity,
        "validation_metrics": validation_metrics,
        "held_out_test_metrics": test_metrics,
        "dataset_class_counts": class_counts,
        "exact_duplicate_files_removed": duplicate_count,
        "dataset_name": "TB_Chest_Radiography_Database",
        "dataset_manifest_sha256": dataset_digest.hexdigest(),
        "split": {
            "seed": SEED,
            "train_images": len(train),
            "validation_images": len(validation),
            "test_images": len(test),
            "unit": "image",
        },
        "limitations": [
            "Research-only image classifier; not a validated medical device or diagnostic system.",
            "Dataset metadata has no patient identifiers; train, validation, and test splits are image-level and may share source/patient characteristics.",
            "Training dataset source composition and image acquisition differ from real deployment populations.",
            "An image-level holdout from this dataset is not independent clinical or external validation.",
            "Model score is not a calibrated probability of disease.",
            "A clinician must assess the complete patient context and confirm any diagnosis or treatment independently.",
        ],
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_state_dict": best_state,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = args.output.with_suffix(args.output.suffix + ".tmp")
    torch.save(artifact, temporary_path)
    temporary_path.replace(args.output)

    metrics_path = args.output.with_suffix(".metrics.json")
    metrics_path.write_text(
        json.dumps({key: value for key, value in artifact.items() if key != "model_state_dict"}, indent=2),
        encoding="utf-8",
    )
    logging.info("Research model saved to %s", args.output)
    logging.info("Metrics saved to %s", metrics_path)
    logging.info("Held-out image-level test metrics: %s", json.dumps(test_metrics, sort_keys=True))
    return artifact


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a research-only TB-labeled chest X-ray screening model."
    )
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--learning-rate", type=float, default=0.0003)
    parser.add_argument("--target-sensitivity", type=float, default=0.90)
    args = parser.parse_args()

    if not args.dataset.is_dir():
        parser.error(f"Dataset directory not found: {args.dataset}")
    if args.epochs < 1 or args.patience < 1 or args.batch_size < 1 or args.workers < 0:
        parser.error("epochs, patience, and batch size must be positive; workers cannot be negative")
    if not 0.5 <= args.target_sensitivity < 1:
        parser.error("target sensitivity must be at least 0.5 and less than 1.0")
    return args


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        train(parse_args())
    except Exception:
        logging.exception("X-ray research model training failed")
        sys.exit(1)
