import pkg from 'jsonwebtoken';
const { verify } = pkg;

// Authentication Middleware
const authenticateAccessToken = (req, res, next) => {
  // Extract token from Authorization header
  const token = req.header("Authorization")?.split(" ")[1];
  try {
    // Verify the token using the secret
    const decoded = verify(token, process.env.JWT_SECRET);
    // Attach the decoded user data to the request object
    req.user = decoded;
    // Continue to the next middleware or route handler
    next();
  } catch (err) {
    // If token verification fails, redirect to refresh token route
    console.error("Token verification failed:", err);
    return res.status(403).json({
      error: "Invalid token",
      message: "Credentials have expired. Please Log In again!",
    });
  }
};

export default authenticateAccessToken;
