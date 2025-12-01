"use client";

import Image from "next/image";
import { LogOut, LogIn, UserPlus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Left side: Logo + Branding */}
      <div className="flex items-center gap-3">
        <Image
          src="/logo-light.ico"
          alt="Deeptrack Logo Light"
          width={40}
          height={40}
          className="rounded-md block dark:hidden"
        />
        <Image
          src="/logo-dark.jpg"
          alt="Deeptrack Logo Dark"
          width={40}
          height={40}
          className="rounded-md hidden dark:block"
        />

        <div className="flex flex-col">
          <span className="text-lg font-semibold text-black dark:text-white leading-tight">
            Deeptrack Gotham
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400 -mt-0.5">
            Deepfakes Detection
          </span>
        </div>
      </div>

      {/* Right side (desktop) */}
      <div className="hidden md:flex items-center gap-6">
        <Link
          href="/"
          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500"
        >
          Home
        </Link>
        {isSignedIn && (
          <>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500"
            >
              History
            </Link>
            <Link
              href="/results"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500"
            >
              Results
            </Link>
          </>
        )}
        <Link
          href="/pricing-billing"
          className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500"
        >
          Pricing &amp; Billing
        </Link>

        {isSignedIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center">
                <Image
                  src={user.imageUrl || "/avatar.png"}
                  alt={user.fullName || "User Avatar"}
                  width={36}
                  height={36}
                  className="rounded-full border border-gray-300 dark:border-gray-700"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium text-gray-800 dark:text-gray-200">{user.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer hover:bg-red-100 dark:hover:bg-gray-900 text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-500"
              >
                Account
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <DropdownMenuItem asChild>
                <Link href="/login" className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <LogIn className="h-4 w-4" /> Log In
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/signup" className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <UserPlus className="h-4 w-4" /> Sign Up
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* <ThemeToggle /> */}
      </div>

      {/* Mobile menu (hamburger) */}
      <div className="flex md:hidden items-center gap-2">
        {/* <ThemeToggle /> */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
            <DropdownMenuItem asChild>
              <Link href="/" className="text-gray-800 dark:text-gray-200">Home</Link>
            </DropdownMenuItem>
            {isSignedIn && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="text-gray-800 dark:text-gray-200">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/results" className="text-gray-800 dark:text-gray-200">Results</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/history" className="text-gray-800 dark:text-gray-200">History</Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href="/pricing-billing" className="text-gray-800 dark:text-gray-200">Pricing &amp; Billing</Link>
            </DropdownMenuItem>
            {isSignedIn ? (
              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer hover:bg-red-100 dark:hover:bg-gray-900 text-red-600 dark:text-red-400"
              >
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/login" className="text-gray-800 dark:text-gray-200">
                    <LogIn className="h-4 w-4 mr-2" /> Log In
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/signup" className="text-gray-800 dark:text-gray-200">
                    <UserPlus className="h-4 w-4 mr-2" /> Sign Up
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}