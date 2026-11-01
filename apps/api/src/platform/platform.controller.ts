import type { Request, Response } from "express";
import { ZodError } from "zod";
import { SupabaseRpcError } from "../services/db/supabase-rest.client.js";
import {
  createCompany,
  findCompany,
  getPlatformOverview,
  getPublicBranding,
  listCompanies,
  updateCompany,
  updateCompanyBranding,
  updateCompanyRobot,
  updateCompanySubscription,
  updatePlatformBranding,
} from "./platform.service.js";

function validationError(
  error: unknown,
  res: Response,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: error.issues,
    });
  }

  throw error;
}

export async function publicBranding(
  _req: Request,
  res: Response,
) {
  const branding = await getPublicBranding();

  return res.json({
    ok: true,
    data: branding,
  });
}

export async function platformOverview(
  _req: Request,
  res: Response,
) {
  const config = await getPlatformOverview();

  return res.json({
    ok: true,
    data: config,
  });
}

export async function companies(
  _req: Request,
  res: Response,
) {
  const data = await listCompanies();

  return res.json({
    ok: true,
    data,
  });
}

export async function companyById(
  req: Request,
  res: Response,
) {
  const company = await findCompany(
    req.params.companyId as string,
  );

  if (!company) {
    return res.status(404).json({
      ok: false,
      error: "COMPANY_NOT_FOUND",
    });
  }

  return res.json({
    ok: true,
    data: company,
  });
}

export async function savePlatformBranding(
  req: Request,
  res: Response,
) {
  try {
    const data = await updatePlatformBranding(
      req.body,
    );

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return validationError(error, res);
  }
}

export async function saveCompany(
  req: Request,
  res: Response,
) {
  try {
    const data = await updateCompany(
      req.params.companyId as string,
      req.body,
    );

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "COMPANY_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return validationError(error, res);
  }
}

export async function saveCompanyBranding(
  req: Request,
  res: Response,
) {
  try {
    const data = await updateCompanyBranding(
      req.params.companyId as string,
      req.body,
    );

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "COMPANY_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return validationError(error, res);
  }
}

export async function saveCompanyRobot(
  req: Request,
  res: Response,
) {
  try {
    const data = await updateCompanyRobot(
      req.params.companyId as string,
      req.body,
    );

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "COMPANY_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return validationError(error, res);
  }
}

export async function saveCompanySubscription(
  req: Request,
  res: Response,
) {
  try {
    const data = await updateCompanySubscription(
      req.params.companyId as string,
      req.body,
    );

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "COMPANY_NOT_FOUND",
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return validationError(error, res);
  }
}

export async function createPlatformCompany(
  req: Request,
  res: Response,
) {
  try {
    const data = await createCompany(req.body);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error, res);
    }

    if (error instanceof SupabaseRpcError && error.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "COMPANY_OR_EMAIL_ALREADY_EXISTS",
      });
    }

    console.error("[PLATFORM COMPANY CREATE]", error instanceof Error ? error.message : "UNKNOWN");
    return res.status(500).json({
      ok: false,
      error: "COMPANY_PROVISIONING_FAILED",
    });
  }
}
