<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

$input      = json_decode(file_get_contents('php://input'), true);
$apiKey     = $input['apiKey']      ?? '';
$system     = $input['system']      ?? '';
$userMessage = $input['userMessage'] ?? '';

if (!$apiKey || !$userMessage) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

$payload = json_encode([
    'contents' => [
        ['role' => 'user', 'parts' => [['text' => $userMessage]]]
    ],
    'systemInstruction' => [
        'parts' => [['text' => $system]]
    ],
    'generationConfig' => [
        'maxOutputTokens' => 1024,
        'temperature'     => 0.9
    ]
]);

$url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . urlencode($apiKey);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json']
]);

$response = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
