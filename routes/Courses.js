import express from "express";
const router = express.Router();
import { upload, deleteFileFromCloudinary } from "../lib/cloudinary.js";
import client from "../lib/db.js";
// courses
router.get("/all-courses", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();
    let userId = req.query.userId;
    if (userId === "not_authenticated") {
      userId = null;
    }

    // Base query without user check if no userId
    let coursesQuery = `
      SELECT 
        c.id,
        c.title, 
        c.description,
        c.duration,
        c.price,
        c.category,
        c.thumbnail,
        c.stripe_account_id,
        u.username as instructor,
        ${
          userId
            ? "CASE WHEN se.course_id IS NOT NULL THEN true ELSE false END"
            : "false"
        } as is_enrolled
      FROM courses c
      JOIN users u ON c.instructor_id = u.user_id
      ${
        userId
          ? "LEFT JOIN student_enrollments se ON c.id = se.course_id AND se.student_id = $1"
          : ""
      }
      WHERE c.duration > 0
    `;

    let countQuery = `
      SELECT COUNT(*) 
      FROM courses c
      JOIN users u ON c.instructor_id = u.user_id
      WHERE c.duration > 0
    `;

    const queryParams = userId ? [userId] : [];

    if (search) {
      const searchParam = userId ? "$2" : "$1";
      coursesQuery += ` AND (LOWER(c.title) LIKE LOWER(${searchParam}) 
                        OR LOWER(c.description) LIKE LOWER(${searchParam})
                        OR LOWER(c.category) LIKE LOWER(${searchParam}))`;
      countQuery += ` AND (LOWER(c.title) LIKE LOWER($1) 
                    OR LOWER(c.description) LIKE LOWER($1)
                    OR LOWER(c.category) LIKE LOWER($1))`;
      queryParams.push(`%${search}%`);
    }

    coursesQuery += ` ORDER BY c.id LIMIT $${queryParams.length + 1} OFFSET $${
      queryParams.length + 2
    }`;

    const [coursesResult, countResult] = await Promise.all([
      client.query(coursesQuery, [...queryParams, limit, offset]),
      client.query(countQuery, search ? [`%${search}%`] : []),
    ]);

    const totalCourses = parseInt(countResult.rows[0].count);
    const hasMore = totalCourses > offset + coursesResult.rows.length;

    res.json({
      success: true,
      courses: coursesResult.rows,
      hasMore,
      currentPage: page,
      totalCourses,
    });
  } catch (error) {
    console.error("Error getting courses:", error);
    res.status(500).json({
      success: false,
      message: "Error getting courses",
      error: error.message,
    });
  }
});

router.get("/coursedata/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const course = await client.query("SELECT * FROM courses WHERE id = $1", [
      id,
    ]);
    if (course.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }
    const videos = await client.query(
      "SELECT * FROM course_videos WHERE course_id = $1 ORDER BY id",
      [id]
    );

    res.json({
      success: true,
      course: course.rows[0],
      videos: videos.rows,
    });
  } catch (error) {
    console.error("Error getting course:", error);
    res.status(500).json({
      success: false,
      message: "Error getting course",
      error: error.message,
    });
  }
});

router.get("/enrolled-courses/:id", async (req, res) => {
  const { id } = req.params; // Extract student ID

  try {
    const result = await client.query(
      `SELECT 
        c.id, c.title, c.description, c.duration, c.price, 
        c.category, c.thumbnail, c.stripe_account_id, 
        u.username AS instructor 
      FROM student_enrollments se 
      JOIN courses c ON c.id = se.course_id 
      JOIN users u ON c.instructor_id = u.user_id
      WHERE se.student_id = $1 
      ORDER BY c.id`, // Explicitly ordering by course ID
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No enrolled courses found",
      });
    }

    res.json({ success: true, courses: result.rows });
  } catch (error) {
    console.error("Error getting enrolled courses:", error);
    res.status(500).json({
      success: false,
      message: "Error getting enrolled courses",
      error: error.message,
    });
  }
});

router.delete("/disenroll/:student_id/:course_id", async (req, res) => {
  const { student_id, course_id } = req.params;

  try {
    const result = await client.query(
      "DELETE FROM student_enrollments WHERE student_id = $1 AND course_id = $2",
      [student_id, course_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    res.json({
      success: true,
      message: "Course disenrolled successfully",
    });
  } catch (error) {
    console.error("Error disenrolling course:", error);
    res.status(500).json({
      success: false,
      message: "Error disenrolling course",
      error: error.message,
    });
  }
});

router.get("/instructor-courses/:id", async (req, res) => {
  const { id } = req.params; // Extract `id` correctly from `req.params`
  try {
    const result = await client.query(
      "SELECT * FROM courses WHERE instructor_id = $1 ORDER BY id ",
      [id]
    );

    // Since `result.rows` is an array of objects, no need to destructure
    res.json({ success: true, courses: result.rows });
  } catch (error) {
    console.error("Error getting courses:", error);
    res.status(500).json({
      success: false,
      message: "Error getting courses",
      error: error.message,
    });
  }
});

router.post(
  "/create-course",
  upload.single("newthumbnail"),
  async (req, res) => {
    try {
      // Get the original URL
      const originalUrl = req.file.path;
      let {
        instructor_id,
        title,
        description,
        price,
        category,
        stripe_account_id,
      } = req.body;
      price = parseFloat(price);

      // Generate the optimized URL
      const optimizedUrl = originalUrl.replace(
        "/upload/",
        "/upload/q_50,w_800/"
      );
      const result = await client.query(
        "INSERT INTO courses (instructor_id, title, description, price, category, thumbnail,stripe_account_id) VALUES ($1, $2, $3, $4, $5, $6,$7) RETURNING *",
        [
          instructor_id,
          title,
          description,
          price,
          category,
          optimizedUrl,
          stripe_account_id,
        ]
      );
      res.status(201).json({
        success: true,
        message: "Course created successfully",
        course: result.rows[0],
      });
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({
        success: false,
        message: "Error creating course",
        error: error.message,
      });
    }
  }
);

router.post(
  "/update-course",
  upload.single("newthumbnail"),
  async (req, res) => {
    const { id, title, description, price, category } = req.body;
    const setprice = parseFloat(price);
    // Check if a new file is uploaded
    let thumbnailUrl, previousThumbnail;
    if (req.file) {
      const originalUrl = req.file.path;
      previousThumbnail = req.body.thumbnail;
      thumbnailUrl = originalUrl.replace("/upload/", "/upload/q_50,w_800/");
    } else {
      thumbnailUrl = req.body.thumbnail; // Make sure the body contains the existing thumbnail URL
    }
    try {
      const response = await client.query(
        "UPDATE courses SET title = $1, description = $2, price = $3, category = $4, thumbnail = $5 WHERE id = $6 RETURNING *",
        [title, description, setprice, category, thumbnailUrl, id]
      );
      res.status(200).json({
        success: true,
        message: "Course updated successfully",
        course: response.rows[0],
      });
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).send("Failed to update course");
    }
    // Delete the previous thumbnail from Cloudinary
    if (previousThumbnail) {
      await deleteFileFromCloudinary(previousThumbnail);
    }
  }
);

router.delete(`/delete-course/:courseid/:instructor_id`, async (req, res) => {
  const { courseid, instructor_id } = req.params; // Access instructor_id from the request body
  // deleting url from cloudinary
  const course = await client.query(
    "SELECT thumbnail FROM courses WHERE id = $1 AND instructor_id = $2",
    [courseid, instructor_id]
  );

  const thumbnail = course.rows[0].thumbnail;
  await deleteFileFromCloudinary(thumbnail);

  const check=await client.query(
    "SELECT * FROM student_enrollments WHERE course_id = $1 ",
    [courseid]
  );

  if(check.rowCount>0){
    return res.status(400).json({
      success: false,
      message: "Course cannot be deleted as students are enrolled",
    });
  }

  const response = await client.query(
    "DELETE FROM courses WHERE id = $1 AND instructor_id = $2",
    [courseid, instructor_id]
  );

  if (response.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Course not found",
    });
  }
  res.status(200).json({
    success: true,
    message: "Course deleted successfully",
  });
});
export default router;
