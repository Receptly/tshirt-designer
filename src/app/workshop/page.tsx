"use client";

import { Download, ExternalLink, PackageCheck, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const orders = [
  { id: "TL-1048", product: "Classic tee", color: "Ink", size: "L", quantity: 2, status: "Ready for print", artwork: "mountain-mark.png", dimensions: "2400 × 1800 px", position: "Front · centered · 24 cm wide", print: "24 × 18 cm" },
  { id: "TL-1047", product: "Classic tee", color: "Cloud", size: "M", quantity: 1, status: "Artwork review", artwork: "sunroom.jpg", dimensions: "3000 × 3000 px", position: "Back · +2 cm / +8 cm", print: "20 × 20 cm" },
  { id: "TL-1046", product: "Classic tee", color: "Moss", size: "XL", quantity: 4, status: "Queued", artwork: "wordmark.png", dimensions: "1600 × 600 px", position: "Front · centered · 22 cm wide", print: "22 × 8 cm" },
];

export default function WorkshopPage() {
  const [query, setQuery] = useState("");
  const visible = orders.filter((order) => `${order.id} ${order.artwork} ${order.status}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="workshop-shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">T</span><span>threadline / workshop</span></Link><Link className="text-button" href="/"><ExternalLink size={15} /> Customer view</Link></header><section className="workshop-content"><div className="workshop-intro"><div><p className="eyebrow">Production desk</p><h1>Orders to make.</h1><p>Every file here is the original artwork, paired with the normalized placement data from the customer&apos;s design.</p></div><div className="workshop-stat"><strong>{orders.length}</strong><span>active orders</span></div></div><div className="workshop-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or artwork" aria-label="Search orders" /></div><button className="filter-button"><PackageCheck size={15} /> All production states</button></div><div className="orders-table"><div className="orders-head"><span>Order</span><span>Garment</span><span>Artwork & placement</span><span>Status</span><span /></div>{visible.map((order) => <article className="order-row" key={order.id}><div><strong>{order.id}</strong><small>Today, 09:42</small></div><div><strong>{order.product}</strong><small>{order.color} · {order.size} · qty {order.quantity}</small></div><div className="artwork-cell"><div className="artwork-preview"><span>IMG</span></div><div><strong>{order.artwork}</strong><small>{order.dimensions}</small><small>{order.position}</small><small>Print area: {order.print}</small></div></div><div><span className={`status ${order.status === "Ready for print" ? "ready" : ""}`}>{order.status}</span></div><button className="download-button" aria-label={`Download ${order.artwork}`}><Download size={16} /></button></article>)}</div></section></main>;
}