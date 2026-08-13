import {
  AppShell,
} from "../../../components/app-shell/AppShell";

import {
  LegacyImageMigration,
} from "./LegacyImageMigration";

import {
  MissingImagesClient,
} from "./MissingImagesClient";

import "./media-missing.css";


export default function MissingImagesPage() {
  return (
    <AppShell>
      <LegacyImageMigration />

      <MissingImagesClient />
    </AppShell>
  );
}
