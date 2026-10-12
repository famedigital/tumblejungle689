import { SiteFooter, SiteHeader } from "@/components/site-frame";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#fff6e8] bg-[radial-gradient(circle_at_0%_0%,#ffe08a_0,transparent_28%),radial-gradient(circle_at_100%_0%,#ffc2b8_0,transparent_26%),radial-gradient(circle_at_78%_22%,#b7ebe3_0,transparent_24%)]">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
