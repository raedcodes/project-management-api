import { AppError } from "../utils/app-error.js";

const LOCATIONS = ["params", "query", "body"];

// Zod issues → [{ location, field, message }]
const toDetails = (location, error) =>
  error.issues.flatMap((issue) => {
    // strictObject reports unknown keys as one issue with an empty path and a `keys` list
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) => ({ location, field: key, message: `Unknown field "${key}"` }));
    }
    return [{ location, field: issue.path.join(".") || null, message: issue.message }];
  });

// Usage: validate({ params: schemaA, body: schemaB }). Every schema is optional.
// Collects problems from all parts first, so the client sees every error in one response.
const validate = (schemas) => (req, res, next) => {
  const details = [];
  const parsed = {};

  for (const location of LOCATIONS) {
    const schema = schemas[location];
    if (!schema) {
      continue;
    }
    const result = schema.safeParse(req[location]);
    if (result.success) {
      parsed[location] = result.data;
    } else {
      details.push(...toDetails(location, result.error));
    }
  }

  if (details.length > 0) {
    return next(new AppError(400, "VALIDATION_ERROR", "Invalid request data", details));
  }

  // From here on, handlers get the cleaned values (trimmed strings, Date objects)
  if ("params" in parsed) {
    req.params = parsed.params;
  }
  if ("body" in parsed) {
    req.body = parsed.body;
  }
  // Express 5's req.query is getter-only and can't be reassigned
  if ("query" in parsed) {
    req.validatedQuery = parsed.query;
  }

  next();
};

export default validate;
