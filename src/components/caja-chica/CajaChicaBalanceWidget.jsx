"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Statistic, Spin } from "antd";
import { WalletOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export default function CajaChicaBalanceWidget({ collapsed }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchBalance = async () => {
    try {
      const today = dayjs().format("YYYY-MM-DD");
      const res = await fetch(`/api/caja-chica?date=${today}`);
      if (res.ok) {
        const data = await res.json();

        let saldoInicial = 0;
        let entradas = 0;
        let salidas = 0;

        data.forEach((mov) => {
          const m = parseFloat(mov.monto);
          if (mov.tipo === "Saldo Inicial") saldoInicial += m;
          if (mov.tipo === "Entrada") entradas += m;
          if (mov.tipo === "Salida") salidas += m;
        });

        setBalance(saldoInicial + entradas - salidas);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();

    const handleUpdate = () => fetchBalance();

    // Escuchar el evento personalizado dispatcheado desde la página principal
    window.addEventListener("caja-chica-updated", handleUpdate);

    return () => {
      window.removeEventListener("caja-chica-updated", handleUpdate);
    };
  }, []);

  if (collapsed) {
    return (
      <div
        onClick={() => router.push("/private/caja-chica")}
        style={{
          cursor: "pointer",
          textAlign: "center",
          padding: "10px 0",
          color: "#fff",
        }}
        title="Caja Chica"
      >
        <WalletOutlined style={{ fontSize: "20px", color: "#52c41a" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 16px 16px" }}>
      <Card
        size="small"
        hoverable
        onClick={() => router.push("/private/caja-chica")}
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          cursor: "pointer",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center" }}>
            <Spin size="small" />
          </div>
        ) : (
          <Statistic
            title={
              <span
                style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px" }}
              >
                Caja Chica (Hoy)
              </span>
            }
            value={balance}
            precision={2}
            valueStyle={{
              color: "#52c41a",
              fontSize: "18px",
              fontWeight: "bold",
            }}
            prefix={<WalletOutlined />}
            suffix="L."
          />
        )}
      </Card>
    </div>
  );
}
