"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = "📭", title, description }: EmptyStateProps) {
  return (
    <div className="card text-center py-12 px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-bold text-chanv-terre mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
