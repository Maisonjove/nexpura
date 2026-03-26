"use client";

import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

export function SessionTimeoutWarning() {
  const { showWarning, extendSession, handleLogout } = useSessionTimeout();

  return (
    <Dialog open={showWarning} onOpenChange={(open) => !open && extendSession()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">Session Timeout Warning</DialogTitle>
          <DialogDescription className="text-center">
            Your session will expire in approximately 5 minutes due to inactivity.
            Would you like to stay signed in?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
          <Button
            onClick={extendSession}
            className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800"
          >
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
