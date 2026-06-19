import * as React from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, Input, Button } from "vite_react_shadcn_ts";
export const Registration = () => {
  const form = useForm({ defaultValues: { name: "Cuong Nguyen", dupr: "4.5" } });
  return (
    <div className="bg-background text-foreground" style={{ padding: 24, borderRadius: 12, maxWidth: 380 }}>
      <Form {...form}>
        <form style={{ display: "grid", gap: 16 }}>
          <FormField name="name" control={form.control} render={({ field }: any) => (
            <FormItem>
              <FormLabel>Team name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormDescription>Shown on the public bracket.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField name="dupr" control={form.control} render={({ field }: any) => (
            <FormItem>
              <FormLabel>DUPR rating</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit">Register team</Button>
        </form>
      </Form>
    </div>
  );
};
