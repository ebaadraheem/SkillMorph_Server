import client from "../lib/db.js";

function formatDuration(seconds) {
    if (seconds >= 3600) {
        const hours = (seconds / 3600).toFixed(1);
        return `${hours} hours`;
    } else if (seconds >= 60) {
        const minutes = Math.round(seconds / 60);
        return `${minutes} minutes`;
    } else {
        return `${seconds} seconds`;
    }
}

function formatCourseRows(rows) {
    return rows.map(row => ({
        ...row,
        duration: formatDuration(row.duration), 
    }));
}

async function executeCourseQuery(action, value) {
  try {
    let query;
    let values = [];
    let result;

    switch (action) {
      case "count_all":
        query = `SELECT category, COUNT(*) AS count
                 FROM courses
                 WHERE duration > 0
                 GROUP BY category
                 ORDER BY category;`;
        result = await client.query(query);
        return { success: true, action: action, data: result.rows };

      case "count_by_category":
        if (!value || value.trim() === "") {
          return {
            success: false,
            error: "Category name is required for 'count_by_category' action.",
          };
        }
        query = ` SELECT COUNT(*) AS count
                  FROM courses
                  WHERE category ILIKE $1 AND duration > 0;`;
        values = [value];
        result = await client.query(query, values);
        return {
          success: true,
          action: action,
          data: result.rows[0].count,
        };

      case "find_course":
        if (!value || value.trim() === "") {
          return {
            success: false,
            error: "Search term is required for 'find_course' action.",
          };
        }

        query = `SELECT
                    title,
                    category,
                    price,
                    duration, 
                    description, 
                    (SELECT username FROM users WHERE user_id = courses.instructor_id) AS instructor
                 FROM courses
                 WHERE (title ILIKE $1 OR description ILIKE $1)
                 AND duration > 0
                 LIMIT 5;`;
        values = [`%${value}%`];
        result = await client.query(query, values);
        return {
          success: true,
          action: action,
          data: formatCourseRows(result.rows), 
        };

      case "find_by_price":
        if (!value || value.trim() === "") {
          return {
            success: false,
            error: "Maximum price is required for 'find_by_price' action.",
          };
        }

        const maxPrice = parseFloat(value);
        if (isNaN(maxPrice)) {
          return {
            success: false,
            error:
              "Value for 'find_by_price' must be a valid number (max price).",
          };
        }
        query = ` SELECT
                    title,
                    category,
                    price,
                    duration, 
                    description, 
                    (SELECT username FROM users WHERE user_id = courses.instructor_id) AS instructor
                  FROM courses
                  WHERE COALESCE(price, 99999.00) <= $1 
                  AND duration > 0
                  ORDER BY price DESC
                  LIMIT 5;`;
        values = [maxPrice];
        result = await client.query(query, values);
        return {
          success: true,
          action: action,
          data: formatCourseRows(result.rows), 
        };
        
      case "find_by_category":
        if (!value || value.trim() === "") {
          return {
            success: false,
            error: "Category name is required for 'find_by_category' action.",
          };
        }

        query = `SELECT
                    title,
                    category,
                    price,
                    duration, 
                    description, 
                    (SELECT username FROM users WHERE user_id = courses.instructor_id) AS instructor
                 FROM courses
                 WHERE category ILIKE $1 
                 AND duration > 0
                 LIMIT 5;`;
        values = [value];
        result = await client.query(query, values);
        return {
          success: true,
          action: action,
          data: formatCourseRows(result.rows), 
        };

      default:
        return {
          success: false,
          error: `Invalid action: '${action}'. Allowed actions: 'count_all', 'count_by_category', 'find_course', 'find_by_price', 'find_by_category'.`,
        };
    }
  } catch (error) {
    console.error("Database Tool Error:", error);
    return {
      success: false,
      error: error.message || "Failed to execute database query.",
    };
  }
}

export { executeCourseQuery };