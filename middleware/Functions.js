import client from "../lib/db";
const addStudentEnrollment = async (student_id, course_id, amount_paid) => {
  try {
    // Insert the enrollment data into the database
    const query = `
      INSERT INTO student_enrollments (student_id, course_id, amount_paid)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [student_id, course_id, amount_paid];

    const result = await client.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error("Error adding enrollment:", error);
    return { error: error.message };
  }
};

const deleteStudentEnrollment = async (student_id, course_id) => {
  try {
    // Delete the enrollment data from the database
    const query = `
        DELETE FROM student_enrollments 
        WHERE student_id = $1 AND course_id = $2
        RETURNING *;
      `;
    const values = [student_id, course_id];

    const result = await client.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return { error: error.message };
  }
};

export { addStudentEnrollment, deleteStudentEnrollment };
