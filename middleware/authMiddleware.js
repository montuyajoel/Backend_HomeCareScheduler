const jwt = require("jsonwebtoken");
const User = require("../models/User");

//--------------protect routes that require login--------------------
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    //expected format:"Bearer <token>"

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "No token provided. Access denied."
        }); //401 = haven't proved who you are yet.
    }

    //take the part after "Bearer ", only taking token string
    const token = authHeader.split(" ")[1];
    try {
        //verify token is valid and not expired, verify JWT signature and check token expiration
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        req.user = decoded;//attach {id,role } to request for downstream use
        next(); //continue to the next middleware/route handler
    } catch(error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

//---------restrict to admin role only--------
const adminOnly = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin only."
        });//403 = I know who you are, but you're not allowed here.
    }
    next();
};

module.exports = {protect, adminOnly};
