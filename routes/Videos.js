import express from "express";
import { upload } from "../lib/cloudinary.js";
import client from "../lib/db.js";
import { deleteFileFromCloudinary } from "../lib/cloudinary.js";
const router = express.Router();

// Route to update a video
router.put("/update-video/:id", upload.single("video"), async (req, res) => {
  // Check if a new file is uploaded
  const { id, title, duration } = req.body;
  let videourl, previousurl;
  if (req.file) {
    const originalUrl = req.file.path;
    previousurl = req.body.video_url;
    videourl = originalUrl.replace("/upload/", "/upload/q_50,w_800/");
  } else {
    videourl = req.body.video_url; // Make sure the body contains the existing video URL
  }
  // update course duration based on new video duration
  const courseId = await client.query(
    "SELECT course_id FROM course_videos WHERE id = $1",
    [id]
  );
  await client.query(
    "UPDATE courses SET duration = duration + $1 WHERE id = $2",
    [duration, courseId.rows[0].course_id]
  );

  const response = await client.query(
    "UPDATE course_videos SET title = $1, duration = $2, video_url = $3 WHERE id = $4 RETURNING *",
    [title, duration, videourl, id]
  );
  res.send({
    success: true,
    message: "Video updated successfully",
    video: response.rows[0],
  });
});

// Route to add a video
router.post("/add-video", upload.single("video"), async (req, res) => {
  const { course_id, title, duration } = req.body;
  
  let videoUrl = req.file.path; // Extract the URL of the uploaded video

  await client.query(
    "UPDATE courses SET duration = duration + $1 WHERE id = $2",
    [duration, course_id]
  );

  const response = await client.query(
    "INSERT INTO course_videos (course_id, title, duration, video_url) VALUES ($1, $2, $3, $4) RETURNING *",
    [course_id, title, duration, videoUrl]
  );
  res.send({
    success: true,
    message: "Video added successfully",

    video: response.rows[0],
  });
});

router.delete("/deletevideo/:id", async (req, res) => {
  const result = await client.query(
    "SELECT video_url FROM course_videos WHERE id = $1",
    [req.params.id]
  );
  const course_id = await client.query(
    "SELECT course_id FROM course_videos WHERE id = $1",
    [req.params.id]
  );
  await client.query(
    "UPDATE courses SET duration = duration - (SELECT duration FROM course_videos WHERE id = $1) WHERE id = $2",
    [req.params.id, course_id.rows[0].course_id]
  );

  await client.query("DELETE FROM course_videos WHERE id = $1", [
    req.params.id,
  ]);
  const videoUrl = result.rows[0].video_url;

  // Delete the video from Cloudinary
  if (videoUrl) {
    await deleteFileFromCloudinary(videoUrl);
  }

  res.send({
    success: true,
    message: "Video deleted successfully",
  });
});

export default router;
