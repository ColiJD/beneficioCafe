"use client";
import { Drawer, List, Badge, Button, Tooltip } from "antd";
import { BellOutlined } from "@ant-design/icons";

export default function NotificationDrawer({
  visible,
  onClose,
  title = "Notificaciones",
  subtitle,
  notifications = [],
  actions = [],
}) {
  // Detecta si las notificaciones son una lista simple o agrupada
  const isGrouped =
    Array.isArray(notifications) &&
    notifications.length > 0 &&
    typeof notifications[0] === "object" &&
    notifications[0].items;

  // Calcula total de notificaciones
  const totalCount = isGrouped
    ? notifications.reduce((acc, group) => acc + group.items.length, 0)
    : notifications.length;

  return (
    <Drawer
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BellOutlined
              style={{
                color: "#1677ff",
                fontSize: 22,
                background: "#e6f4ff",
                padding: 6,
                borderRadius: "50%",
              }}
            />
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#1677ff",
                  lineHeight: "18px",
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {subtitle || "Sin cliente seleccionado"}
              </div>
            </div>
          </div>

          <Badge
            count={totalCount}
            size="default"
            style={{ backgroundColor: "#52c41a" }}
          />
        </div>
      }
      placement="right"
      width={360}
      onClose={onClose}
      open={visible}
   
    >
      {/* 🔹 Botones configurables */}
      {actions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          {actions.map((action, i) => (
            <Tooltip key={i} title={action.tooltip || action.label}>
              <Button
                type={action.type || "primary"}
                icon={action.icon}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* 🔹 Renderizado de notificaciones */}
      {!totalCount ? (
        <div
          style={{
            textAlign: "center",
            color: "#999",
            padding: "2rem 0",
          }}
        >
          <BellOutlined style={{ fontSize: 40, color: "#d9d9d9" }} />
          <p style={{ marginTop: 10 }}>No hay notificaciones pendientes</p>
        </div>
      ) : isGrouped ? (
        notifications.map((group, index) => (
          <div key={index} style={{ marginBottom: 16 }}>
            <h4
              style={{
                color: "#1677ff",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {group.type}
            </h4>
            <List
              dataSource={group.items}
              renderItem={(item, idx) => (
                <List.Item
                  key={idx}
                  style={{
                    background: "white",
                    marginBottom: 8,
                    borderRadius: 8,
                    padding: "0.75rem 1rem",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <BellOutlined
                        style={{ color: "#1677ff", fontSize: 18, marginTop: 4 }}
                      />
                    }
                    title={<span style={{ fontWeight: 500 }}>{item}</span>}
                  />
                </List.Item>
              )}
            />
          </div>
        ))
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item, idx) => (
            <List.Item
              key={idx}
              style={{
                background: "white",
                marginBottom: 8,
                borderRadius: 8,
                padding: "0.75rem 1rem",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <List.Item.Meta
                avatar={
                  <BellOutlined
                    style={{ color: "#1677ff", fontSize: 18, marginTop: 4 }}
                  />
                }
                title={<span style={{ fontWeight: 500 }}>{item}</span>}
              />
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}
