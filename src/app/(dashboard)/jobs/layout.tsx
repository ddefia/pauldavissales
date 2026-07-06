export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="flex items-center gap-3 pt-1">
        <div className="h-9 w-1.5 rounded-full bg-[#F26522]" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Jobs Review</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Open-job accountability · commitments on the record
          </p>
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
