import cloudinary from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();
// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Use the initialized `cloudinary.v2` object
const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2, // Correctly reference `cloudinary.v2`
  params: {
    folder: "skillmorph-files", // Folder in Cloudinary where files will be stored
    resource_type: "auto", // Automatically detect the resource type (image/video)
  },
});

const upload = multer({ storage });
const deleteFileFromCloudinary = async (url) => {
  try {
    // Extract public_id and file type from the URL
    const urlParts = url.split("/");
    const filePath = urlParts.slice(-2).join("/"); // Extract folder and file name if applicable
    const publicId = filePath.split(".")[0]; // Remove file extension
    const fileType = filePath.split(".")[1]; // Extract file extension

    // Determine resource type based on file extension
    const resourceType = fileType === "mp4" || fileType === "mov" || fileType === "avi" ? "video" : "image";

    // Perform deletion
    const result = await cloudinary.v2.uploader.destroy(publicId, {
      resource_type: resourceType, // Specify resource type
      invalidate: true, // Invalidate cached copies of the asset
    });
    return result;
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    throw error;
  }
};


export { upload, deleteFileFromCloudinary };
