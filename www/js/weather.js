/*!
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Copyright 2014 The moOde audio player project / Tim Curtis
 * Weather display for CoverView screen saver
*/

var WEATHER = {
    data: null,
    refreshInterval: null,
    clockInterval: null,
    lastFetch: 0,
    REFRESH_RATE: 600000, // 10 minutes
    CLOCK_RATE: 1000 // 1 second
};

// Weather condition icon mapping to Font Awesome icons
function getWeatherIcon(iconId) {
    // OpenWeatherMap condition codes: https://openweathermap.org/weather-conditions
    if (iconId >= 200 && iconId < 300) return 'fa-cloud-bolt';         // Thunderstorm
    if (iconId >= 300 && iconId < 400) return 'fa-cloud-rain';         // Drizzle
    if (iconId >= 500 && iconId < 505) return 'fa-cloud-showers-heavy'; // Rain
    if (iconId == 511) return 'fa-snowflake';                           // Freezing rain
    if (iconId >= 520 && iconId < 600) return 'fa-cloud-showers-heavy'; // Shower rain
    if (iconId >= 600 && iconId < 700) return 'fa-snowflake';          // Snow
    if (iconId >= 700 && iconId < 800) return 'fa-smog';               // Atmosphere (fog, mist, etc)
    if (iconId == 800) return 'fa-sun';                                 // Clear sky
    if (iconId == 801) return 'fa-cloud-sun';                           // Few clouds
    if (iconId == 802) return 'fa-cloud';                               // Scattered clouds
    if (iconId >= 803) return 'fa-clouds';                              // Overcast
    return 'fa-cloud';
}

// Get wind direction as compass text
function getWindDirection(deg) {
    var directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var index = Math.round(deg / 22.5) % 16;
    return directions[index];
}

// Format Unix timestamp to time string
function formatWeatherTime(timestamp, show24h) {
    var date = new Date(timestamp * 1000);
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = '';

    if (!show24h) {
        ampm = h >= 12 ? ' PM' : ' AM';
        h = h % 12;
        if (h === 0) h = 12;
    }

    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ampm;
}

// Format forecast time to short hour label
function formatForecastHour(timestamp, show24h) {
    var date = new Date(timestamp * 1000);
    var h = date.getHours();
    if (!show24h) {
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return h + ampm;
    }
    return (h < 10 ? '0' + h : h) + ':00';
}

// Fetch weather data and render
function fetchWeatherData() {
    $.getJSON('command/weather.php?cmd=get_weather', function(data) {
        if (data.error) {
            renderWeatherError(data.error);
            return;
        }
        WEATHER.data = data;
        WEATHER.lastFetch = Date.now();
        renderWeatherDisplay();
    }).fail(function() {
        renderWeatherError('Unable to connect to weather service');
    });
}

// Show weather screen
function showWeatherScreen() {
    fetchWeatherData();
    // Refresh weather data periodically
    WEATHER.refreshInterval = setInterval(fetchWeatherData, WEATHER.REFRESH_RATE);
    // Update clock every second
    updateWeatherClock();
    WEATHER.clockInterval = setInterval(updateWeatherClock, WEATHER.CLOCK_RATE);
}

// Hide weather screen
function hideWeatherScreen() {
    if (WEATHER.refreshInterval) {
        clearInterval(WEATHER.refreshInterval);
        WEATHER.refreshInterval = null;
    }
    if (WEATHER.clockInterval) {
        clearInterval(WEATHER.clockInterval);
        WEATHER.clockInterval = null;
    }
    $('#ss-weather').html('');
}

// Update the clock portion of the weather display
function updateWeatherClock() {
    var date = new Date();
    var show24h = SESSION.json['scnsaver_mode'] == 'Weather (24-hour)';
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = '';

    if (!show24h) {
        ampm = ' ' + (h >= 12 ? 'PM' : 'AM');
        h = h % 12;
        if (h === 0) h = 12;
    }

    var timeStr = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);

    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    var dateStr = days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate();

    $('#weather-clock-time').text(timeStr);
    $('#weather-clock-ampm').text(ampm);
    $('#weather-clock-date').text(dateStr);
}

// Render the weather display
function renderWeatherDisplay() {
    if (!WEATHER.data || WEATHER.data.error) return;

    var d = WEATHER.data;
    var show24h = SESSION.json['scnsaver_mode'] == 'Weather (24-hour)';

    var html = '<div class="weather-container">';

    // Top section: Clock + Location
    html += '<div class="weather-header">';
    html += '<div class="weather-clock">';
    html += '<span id="weather-clock-time" class="weather-clock-time"></span>';
    html += '<span id="weather-clock-ampm" class="weather-clock-ampm"></span>';
    html += '<div id="weather-clock-date" class="weather-clock-date"></div>';
    html += '</div>';
    html += '<div class="weather-location"><i class="fa-solid fa-sharp fa-location-dot"></i> ' + d.location + '</div>';
    html += '</div>';

    // Main weather section
    html += '<div class="weather-main">';

    // Current conditions - left
    html += '<div class="weather-current">';
    html += '<div class="weather-icon"><i class="fa-solid fa-sharp ' + getWeatherIcon(d.current.icon_id) + '"></i></div>';
    html += '<div class="weather-temp">' + d.current.temp + '<span class="weather-unit">' + d.units + '</span></div>';
    html += '<div class="weather-desc">' + d.current.description + '</div>';
    html += '<div class="weather-feels">Feels like ' + d.current.feels_like + d.units + '</div>';
    html += '</div>';

    // Details - right
    html += '<div class="weather-details">';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-droplet"></i><span class="weather-detail-label">Humidity</span><span class="weather-detail-value">' + d.current.humidity + '%</span></div>';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-wind"></i><span class="weather-detail-label">Wind</span><span class="weather-detail-value">' + d.current.wind_speed + ' ' + d.wind_unit + ' ' + getWindDirection(d.current.wind_deg) + '</span></div>';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-gauge"></i><span class="weather-detail-label">Pressure</span><span class="weather-detail-value">' + d.current.pressure + ' hPa</span></div>';
    if (d.current.visibility !== null) {
        html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-eye"></i><span class="weather-detail-label">Visibility</span><span class="weather-detail-value">' + d.current.visibility + ' km</span></div>';
    }
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-temperature-arrow-down"></i><span class="weather-detail-label">Low</span><span class="weather-detail-value">' + d.current.temp_min + d.units + '</span></div>';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-temperature-arrow-up"></i><span class="weather-detail-label">High</span><span class="weather-detail-value">' + d.current.temp_max + d.units + '</span></div>';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-sunrise"></i><span class="weather-detail-label">Sunrise</span><span class="weather-detail-value">' + formatWeatherTime(d.current.sunrise, show24h) + '</span></div>';
    html += '<div class="weather-detail-row"><i class="fa-solid fa-sharp fa-sunset"></i><span class="weather-detail-label">Sunset</span><span class="weather-detail-value">' + formatWeatherTime(d.current.sunset, show24h) + '</span></div>';
    html += '</div>';

    html += '</div>'; // weather-main

    // Forecast section
    if (d.forecast && d.forecast.length > 0) {
        html += '<div class="weather-forecast">';
        html += '<div class="weather-forecast-title">Forecast</div>';
        html += '<div class="weather-forecast-items">';
        for (var i = 0; i < Math.min(d.forecast.length, 6); i++) {
            var fc = d.forecast[i];
            html += '<div class="weather-forecast-item">';
            html += '<div class="weather-fc-time">' + formatForecastHour(fc.dt, show24h) + '</div>';
            html += '<div class="weather-fc-icon"><i class="fa-solid fa-sharp ' + getWeatherIcon(fc.icon_id) + '"></i></div>';
            html += '<div class="weather-fc-temp">' + fc.temp + '°</div>';
            if (fc.pop > 0) {
                html += '<div class="weather-fc-pop"><i class="fa-solid fa-sharp fa-droplet"></i> ' + fc.pop + '%</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }

    html += '</div>'; // weather-container

    $('#ss-weather').html(html);
    // Trigger clock update immediately
    updateWeatherClock();
}

// Render error state
function renderWeatherError(message) {
    var html = '<div class="weather-container">';
    html += '<div class="weather-error">';
    html += '<div class="weather-error-icon"><i class="fa-solid fa-sharp fa-cloud-exclamation"></i></div>';
    html += '<div class="weather-error-msg">' + message + '</div>';
    html += '<div class="weather-error-hint">Configure weather settings in<br>Menu &gt; Preferences &gt; CoverView</div>';
    html += '</div>';
    html += '</div>';
    $('#ss-weather').html(html);
}
