import pymysql

def init_db():
    try:
        # Connect to XAMPP MySQL (default root with no password)
        connection = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            # Create Database
            cursor.execute("CREATE DATABASE IF NOT EXISTS ethiomed_db;")
            cursor.execute("USE ethiomed_db;")
            
            # Create Users Table
            create_table_query = """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                google_id VARCHAR(255) NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            cursor.execute(create_table_query)
            cursor.execute("SHOW COLUMNS FROM users LIKE 'google_id'")
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE"
                )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS patients (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    full_name VARCHAR(150) NOT NULL,
                    phone VARCHAR(40) NULL,
                    date_of_birth DATE NULL,
                    gender VARCHAR(30) NULL,
                    notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_patients_id_user (id, user_id),
                    INDEX idx_patients_user_name (user_id, full_name),
                    CONSTRAINT fk_patients_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS appointments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    patient_id INT NOT NULL,
                    scheduled_at DATETIME NOT NULL,
                    reason VARCHAR(200) NOT NULL,
                    location VARCHAR(150) NULL,
                    status ENUM('scheduled', 'completed', 'cancelled')
                        NOT NULL DEFAULT 'scheduled',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_appointments_user_schedule (user_id, scheduled_at),
                    CONSTRAINT fk_appointments_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_appointments_patient_owner
                        FOREIGN KEY (patient_id, user_id)
                        REFERENCES patients(id, user_id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS clinical_assessments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    patient_id INT NOT NULL,
                    radiology_report TEXT NOT NULL,
                    guideline_matches JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_assessments_owner (id, patient_id, user_id),
                    INDEX idx_assessments_patient_date (user_id, patient_id, created_at),
                    CONSTRAINT fk_assessments_patient_owner
                        FOREIGN KEY (patient_id, user_id)
                        REFERENCES patients(id, user_id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS medication_plans (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    patient_id INT NOT NULL,
                    assessment_id INT NOT NULL,
                    medication_name VARCHAR(200) NOT NULL,
                    dose VARCHAR(150) NOT NULL,
                    route VARCHAR(100) NOT NULL,
                    frequency VARCHAR(150) NOT NULL,
                    duration VARCHAR(150) NOT NULL,
                    timing VARCHAR(250) NOT NULL,
                    instructions TEXT NULL,
                    guideline_pages JSON NOT NULL,
                    clinician_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_medication_plans_assessment (user_id, assessment_id),
                    CONSTRAINT fk_medication_assessment_owner
                        FOREIGN KEY (assessment_id, patient_id, user_id)
                        REFERENCES clinical_assessments(id, patient_id, user_id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS xray_screenings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    patient_id INT NOT NULL,
                    stored_image_path VARCHAR(500) NOT NULL,
                    image_sha256 CHAR(64) NOT NULL,
                    model_score DOUBLE NOT NULL,
                    review_threshold DOUBLE NOT NULL,
                    review_flagged BOOLEAN NOT NULL,
                    model_version VARCHAR(100) NOT NULL,
                    held_out_test_metrics JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_xray_screenings_patient_date (user_id, patient_id, created_at),
                    CONSTRAINT fk_xray_screenings_patient_owner
                        FOREIGN KEY (patient_id, user_id)
                        REFERENCES patients(id, user_id)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
            
        connection.commit()
        print("Database 'ethiomed_db' and application tables created successfully!")
        
    except Exception as e:
        print(f"Error connecting to MySQL: {e}")
        print("Please ensure XAMPP MySQL is running.")
        raise
    finally:
        if 'connection' in locals() and connection.open:
            connection.close()

if __name__ == "__main__":
    init_db()
