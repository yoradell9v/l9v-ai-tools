"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      navLayout="around"
      className={cn("rounded-lg border p-3", className)}
      classNames={{
        root: "flex flex-col",
        months: "flex flex-col sm:flex-row gap-4",
        month: "grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-4 items-center",
        month_caption: "justify-self-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "col-span-3 w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 rounded-md font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "relative h-9 w-9 text-center text-sm p-0",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground opacity-100",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...rest }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon
              className={cn("h-4 w-4", chevronClassName)}
              {...rest}
            />
          );
        },
        PreviousMonthButton: ({ className, children, ...rest }) => (
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "size-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100",
              className
            )}
            {...rest}
          >
            {children}
          </button>
        ),
        NextMonthButton: ({ className, children, ...rest }) => (
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "size-7 shrink-0 bg-transparent p-0 opacity-50 hover:opacity-100",
              className
            )}
            {...rest}
          >
            {children}
          </button>
        ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
