"use client";
import { Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <Button
      danger
      type="primary"
      icon={<LogoutOutlined />}
      block
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Cerrar sesión
    </Button>
  );
}
