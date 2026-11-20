import { ImageResponse } from "next/og";

export const alt = "DuePing — Track every invoice. Follow up without the stress.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#15221E", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#236B57", display: "flex" }} />
          DuePing
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>Track every invoice.</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, color: "#6FCFAE" }}>Follow up without the stress.</div>
        </div>
        <div style={{ fontSize: 28, color: "#B8C6BF" }}>Invoice tracking · partial payments · respectful reminders</div>
      </div>
    ),
    size,
  );
}
