param(
    [Parameter(Mandatory)][string]$SenderEmail,
    [Parameter(Mandatory)][string]$SenderName,
    [string]$RecipientEmail = $SenderEmail
)

$ErrorActionPreference = 'Stop'
$apiKey = $env:BREVO_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    $secret = Read-Host 'Brevo API key' -AsSecureString
    $apiKey = [System.Net.NetworkCredential]::new('', $secret).Password
}

$template = Join-Path $PSScriptRoot '../backend/src/main/resources/email/otp.html'
$html = (Get-Content -Raw -Encoding UTF8 -LiteralPath $template).
    Replace('{{CODE}}', '482731').
    Replace('Verify your email', 'OTP template preview').
    Replace('Enter this code in FlexirRides to continue. It expires in 5 minutes.',
        'This is a test of the FlexirRides email template. The sample code cannot be used to sign in.')
$body = @{
    sender = @{ email = $SenderEmail; name = $SenderName }
    to = @(@{ email = $RecipientEmail })
    subject = 'FlexirRides - OTP template test'
    htmlContent = $html
    textContent = 'FlexirRides OTP template test. Sample code: 482731. This code cannot be used to sign in.'
    tags = @('otp-template-test')
} | ConvertTo-Json -Depth 5 -Compress

try {
    $result = Invoke-RestMethod -Uri 'https://api.brevo.com/v3/smtp/email' -Method Post `
        -Headers @{ 'api-key' = $apiKey } -ContentType 'application/json; charset=utf-8' `
        -Body $body -TimeoutSec 20 -MaximumRedirection 0
    if (-not $result.messageId) { throw 'Brevo did not return a message ID.' }
    Write-Output "Brevo accepted the preview: $($result.messageId)"
} catch {
    $details = $_.ErrorDetails.Message
    if ($details) { throw "Brevo rejected the preview: $details" }
    throw
}
