-- Make EUR canonical for seeded/catalog prices by converting existing CZK products to EUR.
-- Conversion uses latest available EUR->CZK rate from ExchangeRate.

UPDATE `Product` p
JOIN `Currency` currentCurrency ON currentCurrency.id = p.currencyId
JOIN (
  SELECT
    er.exchangeRate AS czkPerEur,
    eur.id AS eurId
  FROM `ExchangeRate` er
  JOIN `Currency` fromCurrency ON fromCurrency.id = er.fromCurrencyId
  JOIN `Currency` toCurrency ON toCurrency.id = er.toCurrencyId
  JOIN `Currency` eur ON eur.code = 'EUR'
  WHERE fromCurrency.code = 'EUR'
    AND toCurrency.code = 'CZK'
    AND er.exchangeRate > 0
  ORDER BY er.effectiveDate DESC, er.id DESC
  LIMIT 1
) latestRate
SET
  p.price = ROUND(p.price / latestRate.czkPerEur),
  p.currencyId = latestRate.eurId
WHERE currentCurrency.code = 'CZK';
