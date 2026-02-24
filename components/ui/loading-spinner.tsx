import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  message?: string;
}

export default function LoadingSpinner({ 
  size = "md", 
  fullScreen = false,
  message = "Loading..."
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  const containerClasses = fullScreen
    ? "min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black"
    : "flex flex-col items-center justify-center py-12";

  return (
    <div className={containerClasses}>
      <div className="relative">
        {/* Outer spinning ring */}
        <div
          className={`${sizeClasses[size]} border-4 border-gray-200 dark:border-gray-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin`}
        />
        
        {/* Inner pulsing dot */}
        <div
          className={`absolute inset-0 flex items-center justify-center`}
        >
          <div
            className={`${size === "sm" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-4 h-4"} bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse`}
          />
        </div>
      </div>
      
      {message && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
