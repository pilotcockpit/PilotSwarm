import { Link } from "@tanstack/react-router";
import { TopBar } from "@/shell/AppShell";
import { EmptyState } from "@/components/empty";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <>
      <TopBar crumbs={[{ label: "Not found" }]} />
      <EmptyState level={2} title="There's nothing at this address" className="flex-1" action={<Button asChild><Link to="/">Go to Home</Link></Button>}>Check the link, or find what you need with ⌘K.</EmptyState>
    </>
  );
}
