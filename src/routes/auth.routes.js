import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";
import { loginLimiter, registerLimiter } from "../middlewares/rate-limit.middleware.js";

// Public routes: no authenticate middleware (you can't need a token to get a token)
const router = express.Router();

router.post("/register", [registerLimiter, validate({ body: registerSchema })], register);
router.post("/login", [loginLimiter, validate({ body: loginSchema })], login);

export default router;
