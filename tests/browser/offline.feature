Feature: Existing subdirectory and offline integration checks
  Scenario: Service worker opt-out, precache and offline progress
    Given the subdirectory application is loaded with PWA disabled
    Then no service worker is registered and the graph is visible
    When I open the subdirectory application with PWA enabled
    Then the service worker activates and precaches the library
    When I change a subject status and navigate offline
    Then the selected variant and subject progress are retained offline
    And the offline run has no browser exceptions
