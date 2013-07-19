JSDecimal
=========

A JavaScript implementation of the decimal type.
Compatible with the "decimal type" of the ECMA-334 (C# Language Specification, 4th edition).

Usage
=====

Load "lib/decimal.js" when using from the browser.

You can build a Decimal object by a String, a Number or an existing Decimal object.

The instance methods of the Decimal type is as follows:

    add(another)
    sub(another)
    mul(another)
    div(another)
    compare(another)
    isZero()
    toString()
    toFloat()

I think their functionalities are self-explanatory.

All other instance methods are private supposed to be used internally; when you use them, do so at your own risk.

The Decimal class has a class method.

    round(obj, digits, mode)

The functionalities of this method is the same as the .NET version. For example, if you want to round off a number to the second decimal place, you can do so by writing something like:

    Decimal.round(Decimal(1.234), 2, Decimal.MidpointRounding.AwayFromZero)

This returns a Decimal object with the value of 1.23.

Specification
=============

The Decimal Type can represent numbers within the range of +/- 0 ~ 9999999999999999999999999999 with 28 significant digits.

The Decimal Type is a floating point number system. Contrary to the Number Type of JavaScript, which is a binary floating-point type, the Decimal Type is scaled by 10. For example, the Decimal representation of 0.1 is 1000000000000000000000000000 * 10^-28.

This implementation makes the Decimal Type less prone to round-off errors when handling decimal numbers. The calculation of Decimal(0.1).mul(0.2).sub(0.3).div(0.4).toNumber() will give a result of 0.7, while calculation of (0.1 * 0.2 - 0.3) / 0.4 with a Number Type yields -0.6999999999999998.

Numbers represented by the Decimal Type have 28-digits precision. This means the least significant bits will be rounded off in some calculations. For example, Decimal(1).div(7).toString() gives "0.1428571428571428571428571429" (with 28 significant digits), but when you add 1 to it, the last "9" is rounded up and the result will be "1.142857142857142857142857143".

For Decimals with an absolute value less than 1, the value is exact to "28th decimal place". This means Decimal(1).div("700000000000000000000").toString() will give a result of "0.0000000000000000000014285714" (exact to 28th decimal place) and not "0.000000000000000000001428571428571428571428571429" (with 28 valid numbers).
