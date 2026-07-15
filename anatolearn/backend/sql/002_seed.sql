TRUNCATE TABLE
    quiz_questions,
    resources,
    quizzes,
    videos,
    annotations,
    models,
    programs
RESTART IDENTITY CASCADE;

INSERT INTO programs (name, description) VALUES
('Physiotherapy', 'Anatomy learning content for physiotherapy students.'),
('Occupational Therapy', 'Anatomy resources for occupational therapy students.'),
('Radiography', 'Anatomy and imaging-related learning content.'),
('Nursing', 'Foundational anatomy content for nursing students.');

INSERT INTO models (program_id, title, description, file_path) VALUES
(1, 'A1', '3DF Zephyr exported model.', '/models/anatomy/scene.glb'),
(1, 'A2 (SketchFab)', 'SketchFab exported model.', '/models/anatomy/scene.gltf'),
(1, 'A1 Copy', 'Duplicate demo entry for testing model selection.', '/models/anatomy/scene.glb');

INSERT INTO videos (program_id, title, description, video_path, thumbnail_path, is_published) VALUES
(1, 'Introduction to Anatomy', 'Placeholder educational video for testing the videos page.', '/videos/s.mp4', NULL, true);

INSERT INTO quizzes (program_id, title, description, type, category, is_published) VALUES
(1, 'Muscular System Basics', 'Basic MCQ quiz for anatomy self-assessment.', 'MCQ', 'Muscular', true),
(1, 'Cardiovascular Anatomy Practical', 'Practical-style quiz for identifying anatomical structures.', 'Practical', 'Cardiovascular', true),
(1, 'Respiratory System Review', 'Mixed review quiz for respiratory anatomy.', 'Mixed', 'Respiratory', true);

INSERT INTO quiz_questions (
    quiz_id,
    question,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_option
) VALUES
(1, 'Which muscle is responsible for flexing the elbow?', 'Triceps Brachii', 'Biceps Brachii', 'Deltoid', 'Pectoralis Major', 'B'),
(1, 'Which muscle group is located at the front of the thigh?', 'Hamstrings', 'Quadriceps', 'Gastrocnemius', 'Latissimus Dorsi', 'B'),
(1, 'Which muscle is mainly responsible for shoulder abduction?', 'Deltoid', 'Biceps Brachii', 'Rectus Abdominis', 'Sartorius', 'A'),

(2, 'Which chamber pumps blood to the body?', 'Right Atrium', 'Right Ventricle', 'Left Atrium', 'Left Ventricle', 'D'),
(2, 'Which vessel carries oxygenated blood away from the heart?', 'Pulmonary Artery', 'Pulmonary Vein', 'Aorta', 'Vena Cava', 'C'),
(2, 'Which valve is located between the left atrium and left ventricle?', 'Tricuspid Valve', 'Mitral Valve', 'Pulmonary Valve', 'Aortic Valve', 'B'),

(3, 'Which structure is commonly known as the windpipe?', 'Bronchus', 'Trachea', 'Alveolus', 'Diaphragm', 'B'),
(3, 'Which muscle mainly drives normal breathing?', 'Diaphragm', 'Deltoid', 'Masseter', 'Biceps Brachii', 'A'),
(3, 'Where does gas exchange primarily occur?', 'Trachea', 'Bronchi', 'Alveoli', 'Larynx', 'C');

INSERT INTO resources (
    program_id,
    title,
    description,
    resource_type,
    file_path
)
VALUES
(
    1,
    'TeachMeAnatomy',
    'Comprehensive anatomy reference covering muscles, bones, nerves, vessels and organs.',
    'link',
    'https://teachmeanatomy.info/'
);