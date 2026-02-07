// 📂 app/page/menu/page.js
import Link from "next/link";
import Image from "next/image";
import { menuItems } from "@/lib/menu";
import "@/style/menu.css";

export default function Menu() {
  return (
    <main className="menu-container">
      {menuItems.map(({ id, name, image }) => (
        <Link key={id} href={`/private/page/menu/${id}`} className="menu-card">
          <Image
            src={image}
            alt={name}
            className="menu-card-image"
            width={320}
            height={140}
            style={{ objectFit: "cover" }}
            priority={id === 1}
          />
          <h2 className="menu-card-title">{name}</h2>
        </Link>
      ))}
    </main>
  );
}
