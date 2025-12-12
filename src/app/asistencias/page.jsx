"use client";

export default function ServidorPage() {
    const schedule = [
        { fecha: "sáb. 27 abr.", servicio: "10:00 a.m.", estado: "Programado" },
        { fecha: "sáb. 4 may.", servicio: "10:00 a.m.", estado: "—" },
        { fecha: "sáb. 11 may.", servicio: "10:00 a.m.", estado: "—" },
        { fecha: "sáb. 18 may.", servicio: "10:00 a.m.", estado: "—" },
    ];

    return (
        <>
            <style>{`
        :root {
          --bg-dark: #0b0d10;
        }

        /* ====== FONDO PREMIUM APPLE 2025 ====== */
        .screen {
          width: 100%;
          height: 100vh;
          padding-top: 40px;
          display: flex;
          justify-content: center;
          overflow-y: auto;
          background: radial-gradient(1200px 600px at 10% 10%, rgba(40,45,55,0.20), transparent 12%),
                      radial-gradient(1000px 700px at 90% 90%, rgba(70,60,90,0.08), transparent 18%),
                      linear-gradient(180deg, #0c0f12 0%, #06070a 100%);
          background-color: var(--bg-dark);
          background-image: url("https://grainy-gradients.vercel.app/noise.svg");
          background-blend-mode: overlay;
        }

        /* ====== CARD LIQUID GLASS ====== */
        .glass-card {
          width: 92%;
          max-width: 480px;
          padding: 32px;
          border-radius: 32px;
          background: rgba(255,255,255,0.035);
          backdrop-filter: blur(22px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            0 26px 60px rgba(0,0,0,0.65),
            inset 0 1px 0 rgba(255,255,255,0.03),
            inset 0 -12px 30px rgba(0,0,0,0.55);
          animation: fadein .6s ease;
          position: relative;
        }

        .glass-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          box-shadow: 0 0 60px rgba(90,120,160,0.12);
          mix-blend-mode: screen;
        }

        /* ====== NAV SUPERIOR ====== */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .menu-btn,
        .bell-btn {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.25));
          box-shadow:
            0 10px 26px rgba(0,0,0,0.55),
            inset 0 2px 6px rgba(255,255,255,0.03);
          cursor: pointer;
        }

        .icon-line {
          width: 24px;
          height: 3px;
          background: rgba(255,255,255,0.85);
          border-radius: 10px;
          margin: 3px 0;
        }

        .bell-icon {
          width: 22px;
          height: 22px;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.7));
        }

        h1 {
          flex: 1;
          text-align: center;
          font-size: 46px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: #ffffff;
          text-shadow: 0 8px 28px rgba(0,0,0,0.65);
        }

        /* ====== BOTONES ====== */
        .buttons-row {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .btn {
          position: relative;
          padding: 16px 42px;
          font-size: 20px;
          font-weight: 700;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.09);
          color: white;
          cursor: pointer;
          transition: 0.22s ease;
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          box-shadow:
            0 14px 36px rgba(0,0,0,0.55),
            inset 0 2px 10px rgba(255,255,255,0.03),
            inset 0 -10px 22px rgba(0,0,0,0.45);
        }

        .btn::before {
          content:'';
          position:absolute;
          inset: 6px 12px auto 12px;
          height: 38%;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.01));
          opacity: 0.85;
          filter: blur(10px);
          pointer-events:none;
        }

        .btn:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 22px 56px rgba(0,0,0,0.75);
        }

        .btn:active {
          transform: translateY(-1px) scale(.98);
          box-shadow:
            0 10px 22px rgba(0,0,0,0.55),
            inset 0 3px 10px rgba(0,0,0,0.35);
        }

        .asistir {
          background: linear-gradient(135deg, #0a4b3f, #0d6f57);
        }

        .servir {
          background: linear-gradient(135deg, #1b2d59, #22407a);
        }

        /* ====== TITULO ====== */
        .section-title {
          color: white;
          font-size: 26px;
          font-weight: 600;
          margin-bottom: 18px;
          text-shadow: 0 4px 16px rgba(0,0,0,0.6);
        }

        /* ====== TABLA ====== */
        .table {
          background: rgba(255,255,255,0.03);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.06);
          padding: 20px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.03),
            inset 0 -10px 20px rgba(0,0,0,0.4);
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 14px 0;
        }

        .table-header {
          font-weight: 700;
          color: #ffffff;
          opacity: .82;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .table-row {
          font-size: 17px;
          color: #d9d9d9;
          transition: .18s ease;
        }

        .table-row:hover {
          background: rgba(255,255,255,0.02);
          transform: translateY(-2px);
        }

        .table-row + .table-row {
          border-top: 1px solid rgba(255,255,255,0.03);
        }

        /* BADGE */
        .estado-programado {
          background: linear-gradient(180deg, #b89260, #8b6d47);
          padding: 6px 14px;
          border-radius: 999px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          box-shadow:
            0 8px 22px rgba(130,95,55,0.34),
            inset 0 -6px 12px rgba(0,0,0,0.35);
        }

        /* ANIMACIÓN */
        @keyframes fadein {
          from { opacity:0; transform: translateY(20px); }
          to   { opacity:1; transform: translateY(0); }
        }

      `}</style>

            <div className="screen">
                <div className="glass-card">

                    {/* NAV */}
                    <div className="nav">

                        {/* Menú */}
                        <div className="menu-btn">
                            <div>
                                <div className="icon-line"></div>
                                <div className="icon-line"></div>
                                <div className="icon-line"></div>
                            </div>
                        </div>

                        <h1>Servidor de Iglesia</h1>

                        {/* Campana */}
                        <div className="bell-btn">
                            <img
                                src="https://cdn-icons-png.flaticon.com/512/1827/1827347.png"
                                className="bell-icon"
                            />
                        </div>
                    </div>

                    {/* BOTONES */}
                    <div className="buttons-row">
                        <button className="btn asistir">Asistir</button>
                        <button className="btn servir">Servir</button>
                    </div>

                    {/* TITULO */}
                    <h2 className="section-title">Horario</h2>

                    {/* TABLA */}
                    <div className="table">
                        <div className="table-header">
                            <span>Fecha</span>
                            <span>Servicio</span>
                            <span>Estado</span>
                        </div>

                        {schedule.map((item, index) => (
                            <div className="table-row" key={index}>
                                <span>{item.fecha}</span>
                                <span>{item.servicio}</span>
                                <span>
                                    {item.estado === "Programado" ? (
                                        <span className="estado-programado">Programado</span>
                                    ) : (
                                        "—"
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </>
    );
}
