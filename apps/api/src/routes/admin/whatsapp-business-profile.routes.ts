import multer from "multer";
import {
  Router,
} from "express";

import {
  getWhatsappBusinessSettings,
  saveWhatsappBusinessSettings,
} from "../../services/whatsapp/whatsapp-business-settings.service.js";


import {
  getWhatsappBusinessProfile,
  getWhatsappPhoneIdentity,
  updateWhatsappBusinessProfile,
  updateWhatsappProfilePicture,
} from "../../services/whatsapp/whatsapp-business-profile.service.js";


const whatsappProfilePictureUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        5 * 1024 * 1024,

      files:
        1,
    },

    fileFilter:
      (_req, file, callback) => {
        const allowed = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (
          !allowed.includes(
            file.mimetype,
          )
        ) {
          callback(
            new Error(
              "Sólo se permiten imágenes JPG, PNG o WEBP",
            ),
          );

          return;
        }

        callback(
          null,
          true,
        );
      },
  });

export const adminWhatsappBusinessProfileRoutes =
  Router();


adminWhatsappBusinessProfileRoutes.get(
  "/profile",
  async (
    _request,
    response,
  ) => {
    try {
      const [
        profile,
        identity,
      ] =
        await Promise.all([
          getWhatsappBusinessProfile(),
          getWhatsappPhoneIdentity(),
        ]);

      response.json({
        ok:
          true,

        profile,
        identity,
      });
    } catch (error) {
      response
        .status(500)
        .json({
          ok:
            false,

          error:
            error
            instanceof Error
              ? error.message
              : String(error),
        });
    }
  },
);


adminWhatsappBusinessProfileRoutes.put(
  "/profile",
  async (
    request,
    response,
  ) => {
    try {
      const body =
        request.body
        && typeof request.body
          === "object"
          ? request.body
          : {};

      await updateWhatsappBusinessProfile({
        about:
          typeof body.about
            === "string"
            ? body.about
            : undefined,

        address:
          typeof body.address
            === "string"
            ? body.address
            : undefined,

        description:
          typeof body.description
            === "string"
            ? body.description
            : undefined,

        email:
          typeof body.email
            === "string"
            ? body.email
            : undefined,

        websites:
          Array.isArray(
            body.websites,
          )
            ? body.websites.filter(
                (
                  value:
                    unknown,
                ): value is string =>
                  typeof value
                  === "string",
              )
            : undefined,

        vertical:
          typeof body.vertical
            === "string"
            ? body.vertical
            : undefined,
      });

      const profile =
        await getWhatsappBusinessProfile();

      response.json({
        ok:
          true,

        profile,
      });
    } catch (error) {
      response
        .status(500)
        .json({
          ok:
            false,

          error:
            error
            instanceof Error
              ? error.message
              : String(error),
        });
    }
  },
);


adminWhatsappBusinessProfileRoutes.post(
  "/profile-picture",

  whatsappProfilePictureUpload.single(
    "file",
  ),

  async (
    req,
    res,
  ) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            ok:
              false,

            error:
              "La imagen es obligatoria",
          });
      }

      const result =
        await updateWhatsappProfilePicture({
          buffer:
            req.file.buffer,

          mimeType:
            req.file.mimetype,

          filename:
            req.file.originalname,
        });

      return res.json({
        ok:
          true,

        ...result,
      });
    } catch (error) {
      console.error(
        "[WHATSAPP PROFILE PICTURE ROUTE ERROR]",
        error,
      );

      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "No se pudo cambiar la foto",
        });
    }
  },
);


function companyIdFromRequest(
  req: any,
) {
  return (
    req
      .tenantContext
      ?.effectiveCompanyId
    ?? process.env.DEFAULT_COMPANY_ID
    ?? "fulanitas"
  );
}


adminWhatsappBusinessProfileRoutes.get(
  "/settings",
  async (
    req,
    res,
  ) => {
    try {
      const settings =
        await getWhatsappBusinessSettings(
          companyIdFromRequest(
            req,
          ),
        );

      return res.json({
        ok:
          true,

        settings,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  },
);


adminWhatsappBusinessProfileRoutes.put(
  "/settings",
  async (
    req,
    res,
  ) => {
    try {
      const settings =
        await saveWhatsappBusinessSettings(
          companyIdFromRequest(
            req,
          ),

          req.body
          ?? {},
        );

      return res.json({
        ok:
          true,

        settings,
      });
    } catch (error) {
      return res
        .status(400)
        .json({
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  },
);
