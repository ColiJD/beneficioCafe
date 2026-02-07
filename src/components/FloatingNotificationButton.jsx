// src/components/FloatingNotificationButton.jsx
"use client";

import { Badge, Button } from "antd";
import { BellOutlined } from "@ant-design/icons";

export default function FloatingNotificationButton({
  notifications = [],
  onClick,
  style = {},
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1000,
        ...style,
      }}
    >
      <Badge count={notifications.length} offset={[0, 0]}>
        <Button
          type="primary"
          shape="circle"
          icon={<BellOutlined />}
          size="large"
          onClick={onClick}
        />
      </Badge>
    </div>
  );
}
