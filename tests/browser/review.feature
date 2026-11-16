Feature: Existing library and application integration checks
  Background:
    Given the application is loaded without PWA

  Scenario: Theme persistence
    When I change the theme and reload the application
    Then the chosen theme persists without changing the variant
    And no browser exceptions occurred

  Scenario: Embedded library contracts
    Then the embedded library passes its existing integration checks
    And no browser exceptions occurred

  Scenario: Application progress and custom plan editing
    Then the application passes its existing progress and editing checks
    And no browser exceptions occurred
