# Apply the pending-session auth fix across the whole project
# Run this from your project root: C:\Users\user\Downloads\Gotham-Enterprise-fixed

Write-Host "Creating lib/auth.ts wrapper..."
$authWrapper = @'
import { auth as auth0Auth } from "@auth0/nextjs/server";

/**
 * Wrapped Auth0 auth() that treats "pending" sessions as fully signed-in.
 *
 * Background: Auth0 sessions can enter a "pending" status when Organizations
 * are enabled on the Auth0 instance and the user hasn't selected/created one
 * yet. By default, Auth0's auth() treats "pending" as signed-out (userId:
 * null) everywhere, even though the user has a perfectly valid, verified
 * session. This app doesn't use Auth0 Organizations, so we never want a
 * pending org-selection task to lock users out of API routes.
 *
 * Use this `auth()` everywhere instead of importing directly from
 * "@auth0/nextjs/server" in API routes / server components.
 */
export async function auth() {
  return auth0Auth({ treatPendingAsSignedOut: false });
}
'@
Set-Content -Path "lib\auth.ts" -Value $authWrapper -Encoding UTF8

Write-Host "Replacing simple 'import { auth } from @auth0/nextjs/server' across app/api..."
$files = Get-ChildItem -Path "app\api" -Recurse -Filter "route.ts"
$count = 0
foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match 'import \{ auth \} from "@auth0/nextjs/server";') {
        $newContent = $content -replace 'import \{ auth \} from "@auth0/nextjs/server";', 'import { auth } from "@/lib/auth";'
        Set-Content -Path $file.FullName -Value $newContent -NoNewline -Encoding UTF8
        $count++
        Write-Host "  Updated: $($file.FullName)"
    }
    elseif ($content -match 'import \{ auth, currentUser \} from "@auth0/nextjs/server";') {
        $newContent = $content -replace 'import \{ auth, currentUser \} from "@auth0/nextjs/server";', "import { currentUser } from `"@auth0/nextjs/server`";`nimport { auth } from `"@/lib/auth`";"
        Set-Content -Path $file.FullName -Value $newContent -NoNewline -Encoding UTF8
        $count++
        Write-Host "  Updated (split import): $($file.FullName)"
    }
}

Write-Host "Fixing app/admin/dashboard/page.tsx..."
$adminPath = "app\admin\dashboard\page.tsx"
if (Test-Path $adminPath) {
    $content = Get-Content -Path $adminPath -Raw
    $newContent = $content -replace 'import \{ auth, currentUser \} from "@auth0/nextjs/server";', "import { currentUser } from `"@auth0/nextjs/server`";`nimport { auth } from `"@/lib/auth`";"
    Set-Content -Path $adminPath -Value $newContent -NoNewline -Encoding UTF8
    $count++
    Write-Host "  Updated: $adminPath"
}

Write-Host ""
Write-Host "Done. $count files updated to use the pending-session-safe auth() wrapper."
Write-Host "Next steps:"
Write-Host "  1. Remove-Item -Recurse -Force .next"
Write-Host "  2. npm run dev"
