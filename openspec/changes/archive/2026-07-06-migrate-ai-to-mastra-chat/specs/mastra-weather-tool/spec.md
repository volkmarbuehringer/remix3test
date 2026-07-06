## ADDED Requirements

### Requirement: Weather tool is available to the Mastra support agent
The Mastra support agent SHALL expose a `get_weather` tool that retrieves current weather for any location worldwide, and the agent's instructions SHALL list `get_weather` alongside the existing support tools so the model knows it can call it.

#### Scenario: Weather tool is registered on the support agent
- **WHEN** the Mastra instance is constructed with `supportAgent`
- **THEN** `supportAgent.tools` SHALL include a tool with id `get_weather`
- **AND** the tool's `inputSchema` SHALL require a `location` string (1–30 chars)

#### Scenario: Agent instructions mention the weather tool
- **WHEN** `supportAgent.instructions` is read
- **THEN** it SHALL contain a line describing `get_weather` and when to use it (weather queries)

### Requirement: Weather tool returns current conditions from Open-Meteo
The `get_weather` tool SHALL geocode the requested location via the Open-Meteo geocoding API and fetch current temperature, condition, humidity, and wind speed from the Open-Meteo forecast API, returning a structured result.

#### Scenario: Successful weather lookup
- **WHEN** the tool is invoked with `location: "Berlin"`
- **THEN** it SHALL call `https://geocoding-api.open-meteo.com/v1/search?name=Berlin&count=1&language=en&format=json`
- **AND** it SHALL call `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
- **AND** it SHALL return an object containing `location`, `temperature` (rounded integer), `condition` (human-readable label mapped from `weather_code`), `humidity`, and `windSpeed` (rounded integer)

#### Scenario: Unknown location
- **WHEN** the geocoding API returns no results for the given `location`
- **THEN** the tool SHALL throw an error whose message indicates the location was not found

#### Scenario: External API timeout
- **WHEN** the geocoding or forecast request exceeds 10 seconds
- **THEN** the tool SHALL abort the request and propagate the abort error to the caller

### Requirement: Weather tool is implemented as a Mastra tool
The `get_weather` tool SHALL be created with `createTool` from `@mastra/core/tools` and use a Zod v4 `inputSchema`, matching the conventions of the existing `supportTools` entries.

#### Scenario: Tool definition shape
- **WHEN** `supportTools.get_weather` is inspected
- **THEN** it SHALL be a `createTool` instance with `id: 'get_weather'`, a string `description`, an `inputSchema` of `z.object({ location: z.string().min(1).max(30) })`, and an async `execute` function