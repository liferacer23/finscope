export default function Loading() {
  return (
    <div className="loading-workspace" role="status">
      <span className="brand-icon">◈</span>
      <p>Bringing your picture into focus…</p>
      <div className="skeleton" />
    </div>
  );
}
