import express from "express";
import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { loginSchema, refreshTokenSchema, registerSchema } from "../validators/auth.validator.js";
import { loginLimiter, registerLimiter } from "../middlewares/rate-limit.middleware.js";

// Public routes: no authenticate middleware (you can't need a token to get a token)
const router = express.Router();

router.post("/register", [registerLimiter, validate({ body: registerSchema })], register);
router.post("/login", [loginLimiter, validate({ body: loginSchema })], login);

// No access token needed: the refresh token in the body is the proof (the access token may have expired)
router.post("/refresh", validate({ body: refreshTokenSchema }), refresh);
router.post("/logout", validate({ body: refreshTokenSchema }), logout);

export default router;
