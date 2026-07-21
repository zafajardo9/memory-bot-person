import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
}: {
  action: any;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="font-medium"
        >
          Email Address
        </Label>

        <Input
          id="email"
          name="email"
          className="h-11 text-base md:text-sm"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
        />

        <Label
          htmlFor="password"
          className="mt-2 font-medium"
        >
          Password
        </Label>

        <Input
          id="password"
          name="password"
          className="h-11 text-base md:text-sm"
          type="password"
          required
        />
      </div>

      {children}
    </form>
  );
}
