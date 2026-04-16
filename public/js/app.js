document.addEventListener("DOMContentLoaded", () => {
  console.log("تم تهيئة التطبيق 🚀");
  const openBtn = document.getElementById('openAbout');
  const closeBtn = document.getElementById('closeAbout');
  const modal = document.getElementById('aboutModal');

  if (openBtn && closeBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('active'));
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
  }
});
