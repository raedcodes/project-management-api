import * as authService from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";

const register = async (req, res) => {
  const result = await authService.register(req.body);
  return sendSuccess(res, result, 201);
};

const login = async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, result);
};

const refresh = async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return sendSuccess(res, result);
};

const logout = async (req, res) => {
  await authService.logout(req.body.refreshToken);
  return res.status(204).end();
};

export { register, login, refresh, logout };
