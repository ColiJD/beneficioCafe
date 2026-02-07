// components/GenericButton.jsx
"use client";
import { Button } from "antd";
import { UnorderedListOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

export default function GenericButton({
  onClick,
  htmlType = "button",
  disabled = false,
  children,
  type = "primary",
}) {
  return (
    <Button
      type={type}
      htmlType={htmlType}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

const FloatingButton = ({
  title = "Ir al registro",
  icon = null,
  route = "/private/page/transacciones/compra/vista",
  top = 25,
  right = 20,
}) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(route);
  };

  return (
    <div style={{ position: "fixed", top, right, zIndex: 1000 }}>
      <Button
        type="primary"
        icon={icon}
        onClick={handleClick}
        style={{
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}
      >
        {title}
      </Button>
    </div>
  );
  FloatingButton;
};

export { FloatingButton };
