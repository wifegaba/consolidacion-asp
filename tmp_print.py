from pathlib import Path
text = Path(r"src/app/login/maestros/MaestrosClient.tsx").read_text(encoding="utf-8")
start = text.index("<motion.div")
end = text.index("</AnimatePresence>")
print(text[start:end])
