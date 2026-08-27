import {
  Router,
} from "express";

import {
  requirePermission,
} from "../../core/http/permission.middleware.js";

import {
  changeVoiceCallStatus,
  createVoiceCall,
  showVoiceCall,
  showVoiceCalls,
  takeVoiceCall,
} from "./voice-call.controller.js";

import {
  addTranscriptSegment,
  addVoiceCallEvent,
  reserveTranscriptSequence,
} from "./voice-event.controller.js";

import {
  createVoiceRoute,
  showVoiceProfile,
  showVoiceRoutes,
  updateVoiceProfile,
  updateVoiceRoute,
} from "./voice-profile.controller.js";

export const voiceRoutes =
  Router();

voiceRoutes.get(
  "/profile",
  requirePermission("voice.read"),
  showVoiceProfile,
);

voiceRoutes.put(
  "/profile",
  requirePermission("voice.manage"),
  updateVoiceProfile,
);

voiceRoutes.get(
  "/routes",
  requirePermission("voice.read"),
  showVoiceRoutes,
);

voiceRoutes.post(
  "/routes",
  requirePermission("voice.manage"),
  createVoiceRoute,
);

voiceRoutes.put(
  "/routes/:routeId",
  requirePermission("voice.manage"),
  updateVoiceRoute,
);

voiceRoutes.get(
  "/calls",
  requirePermission("voice.read"),
  showVoiceCalls,
);

voiceRoutes.post(
  "/calls",
  requirePermission("voice.call"),
  createVoiceCall,
);

voiceRoutes.get(
  "/calls/:callId",
  requirePermission("voice.read"),
  showVoiceCall,
);

voiceRoutes.post(
  "/calls/:callId/transition",
  requirePermission("voice.manage"),
  changeVoiceCallStatus,
);

voiceRoutes.post(
  "/calls/:callId/takeover",
  requirePermission("voice.takeover"),
  takeVoiceCall,
);

voiceRoutes.post(
  "/calls/:callId/events",
  requirePermission("voice.manage"),
  addVoiceCallEvent,
);

voiceRoutes.post(
  "/calls/:callId/transcript",
  requirePermission("voice.manage"),
  addTranscriptSegment,
);

voiceRoutes.post(
  "/calls/:callId/transcript/sequence",
  requirePermission("voice.manage"),
  reserveTranscriptSequence,
);
