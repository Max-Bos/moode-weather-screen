<?php
/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright 2014 The moOde audio player project / Tim Curtis
 * Weather display feature
*/

require_once __DIR__ . '/../inc/common.php';
require_once __DIR__ . '/../inc/session.php';
require_once __DIR__ . '/../inc/sql.php';

$dbh = sqlConnect();

chkVariables($_GET);
chkVariables($_POST);

switch ($_GET['cmd']) {
	case 'get_weather':
		phpSession('open_ro');
		$apiKey = $_SESSION['weather_api_key'] ?? '';
		$location = $_SESSION['weather_location'] ?? '';
		$units = $_SESSION['weather_units'] ?? 'metric';
		phpSession('close');

		if (empty($apiKey) || empty($location)) {
			echo json_encode(['error' => 'Weather API key or location not configured']);
			break;
		}

		$cacheFile = '/tmp/moode_weather_cache.json';
		$cacheMaxAge = 600; // 10 minutes

		// Check cache
		if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheMaxAge) {
			$cached = file_get_contents($cacheFile);
			if ($cached !== false) {
				echo $cached;
				break;
			}
		}

		// Fetch current weather
		$weatherUrl = 'https://api.openweathermap.org/data/2.5/weather?q=' . urlencode($location)
			. '&appid=' . urlencode($apiKey)
			. '&units=' . urlencode($units);

		// Fetch forecast
		$forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast?q=' . urlencode($location)
			. '&appid=' . urlencode($apiKey)
			. '&units=' . urlencode($units)
			. '&cnt=8'; // Next 24 hours (3h intervals)

		$weatherData = fetchUrl($weatherUrl);
		$forecastData = fetchUrl($forecastUrl);

		if ($weatherData === false || $forecastData === false) {
			echo json_encode(['error' => 'Failed to fetch weather data']);
			break;
		}

		$weather = json_decode($weatherData, true);
		$forecast = json_decode($forecastData, true);

		if (isset($weather['cod']) && $weather['cod'] != 200) {
			echo json_encode(['error' => $weather['message'] ?? 'Weather API error']);
			break;
		}

		$unitSymbol = $units == 'imperial' ? '°F' : '°C';
		$windUnit = $units == 'imperial' ? 'mph' : 'm/s';

		$result = [
			'current' => [
				'temp' => round($weather['main']['temp']),
				'feels_like' => round($weather['main']['feels_like']),
				'temp_min' => round($weather['main']['temp_min']),
				'temp_max' => round($weather['main']['temp_max']),
				'humidity' => $weather['main']['humidity'],
				'pressure' => $weather['main']['pressure'],
				'description' => ucfirst($weather['weather'][0]['description']),
				'icon' => $weather['weather'][0]['icon'],
				'icon_id' => $weather['weather'][0]['id'],
				'wind_speed' => round($weather['wind']['speed'], 1),
				'wind_deg' => $weather['wind']['deg'] ?? 0,
				'clouds' => $weather['clouds']['all'],
				'visibility' => isset($weather['visibility']) ? round($weather['visibility'] / 1000, 1) : null,
				'sunrise' => $weather['sys']['sunrise'],
				'sunset' => $weather['sys']['sunset'],
			],
			'location' => $weather['name'] . ', ' . $weather['sys']['country'],
			'units' => $unitSymbol,
			'wind_unit' => $windUnit,
			'forecast' => [],
			'timestamp' => time()
		];

		// Add forecast data
		if (isset($forecast['list'])) {
			foreach ($forecast['list'] as $item) {
				$result['forecast'][] = [
					'dt' => $item['dt'],
					'temp' => round($item['main']['temp']),
					'icon' => $item['weather'][0]['icon'],
					'icon_id' => $item['weather'][0]['id'],
					'description' => ucfirst($item['weather'][0]['description']),
					'pop' => isset($item['pop']) ? round($item['pop'] * 100) : 0
				];
			}
		}

		$json = json_encode($result);
		file_put_contents($cacheFile, $json);
		echo $json;
		break;

	case 'save_weather_settings':
		phpSession('open');
		if (isset($_POST['weather_api_key'])) {
			$_SESSION['weather_api_key'] = $_POST['weather_api_key'];
			phpSession('write', 'weather_api_key', $_POST['weather_api_key']);
		}
		if (isset($_POST['weather_location'])) {
			$_SESSION['weather_location'] = $_POST['weather_location'];
			phpSession('write', 'weather_location', $_POST['weather_location']);
		}
		if (isset($_POST['weather_units'])) {
			$_SESSION['weather_units'] = $_POST['weather_units'];
			phpSession('write', 'weather_units', $_POST['weather_units']);
		}
		phpSession('close');

		// Clear cache when settings change
		@unlink('/tmp/moode_weather_cache.json');

		echo json_encode('OK');
		break;

	default:
		echo json_encode('Unknown command');
		break;
}

function fetchUrl($url) {
	$ctx = stream_context_create([
		'http' => [
			'timeout' => 10,
			'method' => 'GET',
			'header' => 'Accept: application/json\r\n'
		],
		'ssl' => [
			'verify_peer' => true,
			'verify_peer_name' => true
		]
	]);

	$result = @file_get_contents($url, false, $ctx);
	return $result;
}
