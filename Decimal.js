function Decimal(v) {
    if (!v) {
        this.sig = Array(Decimal.n);
        for (var i = 0; i < Decimal.n; ++i) {
            this.sig[i] = 0;
        }
        this.exp = 0;
        this.is_minus = false;
        return;
    }

    if (v instanceof Decimal) {
        this.sig = v.sig.slice();
        this.exp = v.exp;
        this.is_minus = v.is_minus;
        return;
    }

    var v_str = "";
    if (v instanceof String) {
        v_str = v;
    } else {
        v_str = v.toString();
    }

    this.is_minus = false;

    var ch = v_str.charAt(0);
    if (ch == "+" || ch == "-") {
        this.is_minus = (ch == "-");
        v_str = v_str.substring(1);
    }

    var exp = 0;
    var e_pos = v_str.indexOf("e");
    if (e_pos != -1) {
        exp = -parseInt(v_str.substring(e_pos + 1));
        v_str = v_str.substring(0, e_pos);
    }

    var point_pos = v_str.indexOf(".");
    if (point_pos != -1) {
        v_str = v_str.substring(0, point_pos) +
            v_str.substring(point_pos + 1, v_str.length);
        exp += v_str.length - point_pos;
    }
    v_str = v_str.replace(/^0+/, "");

    var back_zero_count = Decimal.decimal_digits -
        (v_str.length > exp ? v_str.length : exp);

    if (back_zero_count > 0) {
        for (var i = 0; i < back_zero_count; ++i) {
            v_str += "0";
        }
        exp += back_zero_count;
    }
    
    if (v_str.length < Decimal.decimal_digits) {
        var tmp = "";
        for (var i = 0; i < (Decimal.decimal_digits - v_str.length); ++i) {
            tmp += "0";
        }
        v_str = tmp + v_str;
    }

    this.exp = exp;
    if (exp < -1) {
        throw new Decimal.OverflowError();
    }

    this.sig = Array();
    for (var i = 0; i < Decimal.n; ++i) {
        this.sig.unshift(parseFloat(v_str.substring(i *  Decimal.decimal_digits_per_word, (i + 1) * Decimal.decimal_digits_per_word)));
    }

    if (this.isZero()) {
        this.is_minus = false;
    }
}

Decimal.pow = function(n, m) {
    var ret = 1;
    for (var i = 0; i < m; ++i) {
        ret *= n;
    }
    return ret;
};

Decimal.MidpointRounding = {
    AwayFromZero : 0,
    ToEven : 1
};

Decimal.word_base = 16;
Decimal.decimal_digits_per_word = 7;
Decimal.n = 4;
Decimal.decimal_digits = Decimal.decimal_digits_per_word * Decimal.n;
Decimal.one_word = Decimal.pow(10.0, Decimal.decimal_digits_per_word);
Decimal.two_words = Decimal.pow(10.0, (Decimal.decimal_digits_per_word * 2));

Decimal.OverflowError = function() {
    this.message = "OverflowError";
};

Decimal.ZeroDivisionError = function() {
    this.message = "ZeroDivisionError";
};

Decimal.initConstants = function() {
    var tmp = "\\d{";
    tmp += Decimal.decimal_digits_per_word;
    tmp += "}$";
    Decimal.regexp_digits = new RegExp(tmp);
    Decimal.one_word_zeros = "";
    for (var i = 0; i < Decimal.decimal_digits_per_word - 1; ++i) {
        Decimal.one_word_zeros += "0";
    }
    Decimal.zeros = "";
    for (var i = 0; i < Decimal.decimal_digits - 1; ++i) {
        Decimal.zeros += "0";
    }
    Decimal.constants_initialized = true;
}

Decimal.prototype.toString = function() {
    if (this.isZero()) {
        return "0";
    }
    
    if (!Decimal.constants_initialized) {
        Decimal.initConstants();
    }

    var str_sig = "";
    for (var i = Decimal.n - 1; i >= 0; --i) {
        (Decimal.zeros + this.sig[i]).match(Decimal.regexp_digits);
        str_sig += RegExp.lastMatch;
    }

    if (this.exp > 0) {
        str_sig = str_sig.substring(0, Decimal.decimal_digits - this.exp) +
            "." + str_sig.substring(Decimal.decimal_digits - this.exp);
        str_sig = str_sig.replace(/\.?0+$/, "");
    }
    str_sig = str_sig.replace(/^0+/, "");

    if (str_sig.charAt(0) == ".") {
        str_sig = "0" + str_sig;
    }

    if (this.exp == -1) {
        str_sig += "0";
    }
    
    return (this.is_minus ? "-" : "") + str_sig;
};

Decimal.prototype.toFloat = function() {
    return parseFloat(this.toString());
};

Decimal.fromData = function(sig, exp, is_minus) {
    var obj = new Decimal();
    var orig_len = sig.length;
    var valid_num = Decimal.countValidNum(sig);

    obj.exp = (exp < valid_num ? Decimal.decimal_digits + exp - valid_num :
               Decimal.decimal_digits);

    obj.is_minus = is_minus;

    if (obj.exp < -1) {
        throw new Decimal.OverflowError();
    }
           
    var word_diff = Math.floor((exp - obj.exp + Decimal.decimal_digits) /
                               Decimal.decimal_digits_per_word) - Decimal.n;
    var digit_diff = exp - obj.exp - (word_diff *
                                      Decimal.decimal_digits_per_word);

    var to_div = Decimal.pow(10, digit_diff);
    var to_mul = Decimal.pow(10, (Decimal.decimal_digits_per_word -
                                  digit_diff));

    for (var i = 0; i < Decimal.n; ++i) {
        var j = i + word_diff;
        if (j >= 0 && j < orig_len) {
            obj.sig[i] = Math.floor(sig[j] / to_div);
        }
        if (j + 1 >= 0 && j + 1 < orig_len) {
            obj.sig[i] += (sig[j + 1] * to_mul) % Decimal.one_word;
        }
    }
    if (exp > obj.exp) {
        var zero_flag = true;
        for (var i = 0; i < word_diff + 1; ++i) {
            if (i < word_diff) {
                if (i && sig[i - 1]) {
                    zero_flag = false;
                }
            } else {
                var last = (sig[i] * to_mul) % Decimal.one_word;
                if (i > 0) {
                    last += Math.floor(sig[i - 1] / to_div);
                    if (sig[i-1] % to_div) {
                        zero_flag = false;
                    }
                }
                if (last > Decimal.one_word / 2) {
                    obj.sig[0] += 1;
                } else if (last == Decimal.one_word / 2 ) {
                    if (!zero_flag || obj.sig[0] % 2) {
                        obj.sig[0] += 1;
                    }
                }
            }
        }
    }

    if (obj.isZero()) {
        obj.is_minus = false;
    }

    return obj;
};

Decimal.round = function(obj, digits, mode) {
    var ret = new Decimal(obj);
    var pos = obj.exp - digits;

    if (pos <= 0 || pos > Decimal.decimal_digits) {
	return;
    }

    var last_word_pos = Math.floor((pos - 1) / Decimal.decimal_digits_per_word);
    var last_digit_pos = (pos - 1) % Decimal.decimal_digits_per_word;
    var round_word_pos = Math.floor(pos / Decimal.decimal_digits_per_word);
    var round_digit_pos = pos % Decimal.decimal_digits_per_word;

    var tmp = Decimal.pow(10, round_digit_pos);
    var last_digit_is_even = (Math.floor(obj.sig[round_word_pos] / tmp) % 2 
			      == 0);

    var round_up = false;
    var tmp2 = Decimal.pow(10, last_digit_pos + 1);
    
    var zero_flag = true;

    for (var i = 0; i < last_word_pos; ++i) {
	if (obj.sig[i]) {
	    zero_flag = false;
	    ret.sig[i] = 0;
	}
    }

    var last_num = obj.sig[last_word_pos] % tmp2;

    if (last_num > tmp2 / 2) {
	round_up = true;
    } else if (last_num == tmp2 / 2) {
	if (!zero_flag || !(last_digit_is_even &&
			    mode == Decimal.MidpointRounding.ToEven)) {
	    round_up = true;
	}
    }

    ret.sig[last_word_pos] -= ret.sig[last_word_pos] % tmp2;

    if (round_up) {
	// a lazy way (slow but convenient)
	ret = ret.add(new Decimal("1e-" + digits.toString()));
    }

    return ret;
};

Decimal.prototype.compare = function(another) {
    var this_sign = this.is_minus ? -1 : 1;
    if (this.is_minus != another.is_minus) {
        return this_sign;
    }
    return this.absCompare(another) * this_sign;
};

Decimal.prototype.absCompare = function(another) {
    var exp_cmp = another.exp - this.exp;
    if (exp_cmp) {
        return exp_cmp;
    }
    for (var i = Decimal.n - 1; i >= 0; --i) {
        var sig_cmp = this.sig[i] - another.sig[i];
        if (sig_cmp) {
            return sig_cmp;
        }
    }
    return 0;
};

Decimal.prototype.absAddSub = function(smaller, is_sub) {
    if (smaller.isZero()) {
        return new Decimal(this);
    }

    var word_diff = Math.floor((smaller.exp - this.exp) /
                               Decimal.decimal_digits_per_word);
    var mul = Decimal.pow(10, ((smaller.exp - this.exp) %
                               Decimal.decimal_digits_per_word));
    var sign = is_sub ? -1 : 1;
    var carry = is_sub ? Decimal.one_word : 0;
    var adjustment = is_sub ? Decimal.two_words - Decimal.one_word : 0;

    var count = Decimal.n + word_diff + 1;
    var sig = Array(count);

    for (var i = 0; i < count; ++i) {
        sig[i] = carry + adjustment;

        if (i >= word_diff && i - word_diff < Decimal.n) {
            sig[i] += this.sig[i - word_diff] * mul;
        }

        if (i < Decimal.n) {
            sig[i] += smaller.sig[i] * sign;
        }

        carry = Math.floor(sig[i] / Decimal.one_word);
        sig[i] %= Decimal.one_word;
    }

    return Decimal.fromData(sig, smaller.exp, this.is_minus);
};

Decimal.countValidNum = function(sig) {
    for (var i = sig.length - 1; i >= 0; --i) {
        var n = Decimal.one_word;
        for (var j = Decimal.decimal_digits_per_word - 1; j >= 0; --j) {
            n /= 10;
            if (sig[i] >= n) {
                return i * Decimal.decimal_digits_per_word + j + 1;
            }
        }
    }

    return 1;
};

Decimal.prototype.validWords = function() {
    for (var i = this.sig.length - 1; i >= 0; --i) {
        if (this.sig[i]) {
            return i + 1;
        }
    }
    return 1;
};

Decimal.prototype.addSub = function(another, is_sub) {
    var another_decimal = (another instanceof Decimal ? another :
                           new Decimal(another));
    var abs_smaller;
    var abs_larger;
    var ret_is_minus;

    if (this.absCompare(another_decimal) < 0) {
        abs_smaller = this;
        abs_larger = another_decimal;
        ret_is_minus = (another_decimal.is_minus != is_sub);
    } else {
        abs_smaller = another_decimal;
        abs_larger = this;
        ret_is_minus = this.is_minus;
    }

    var is_abs_sub = (abs_smaller.is_minus == abs_larger.is_minus) == is_sub;
    var ret = abs_larger.absAddSub(abs_smaller, is_abs_sub);

    ret.is_minus = ret_is_minus;

    return ret;
};

Decimal.prototype.add = function(another) {
    return this.addSub(another, false);
};

Decimal.prototype.sub = function(another) {
    return this.addSub(another, true);
};

Decimal.prototype.isZero = function() {
    for (var i = 0; i < Decimal.n; ++i) {
        if (this.sig[i]) {
            return false;
        }
    }
    return true;
};

Decimal.prototype.mul = function(another) {
    var another_decimal = (another instanceof Decimal ? another :
                           new Decimal(another));

    if (this.isZero() || another_decimal.isZero()) {
        return Decimal(0);
    }

    var sig = Array(Decimal.n * 2);
    for (var i = 0; i < Decimal.n * 2; ++i) {
        sig[i] = 0;
    }

    for (var i = 0; i < Decimal.n; ++i) {
        for (var j = 0; j < Decimal.n; ++j) {
            var result = sig[i + j] + this.sig[i] * another_decimal.sig[j];
            sig[i + j] = result % Decimal.one_word
            sig[i + j + 1] += Math.floor(result / Decimal.one_word);
        }
    }
    var is_minus = (this.is_minus != another_decimal.is_minus);
    return Decimal.fromData(sig, this.exp + another_decimal.exp, is_minus);
};

Decimal.prototype.div = function(another) {
    var another_decimal = (another instanceof Decimal ? another :
                           new Decimal(another));

    if (another_decimal.isZero()) {
        throw new ZeroDivisionError();
    }

    var added = Decimal.n * 2;
    var this_sig = Array(added);
    for (var i = 0; i < added; ++i) {
        this_sig[i] = 0;
    }
    this_sig = this_sig.concat(this.sig);

    var this_v = this.validWords() + added;
    var another_v = another_decimal.validWords();
    var another_exp = another_decimal.exp;

    var another_sig = another_decimal.sig.slice();
    if (another_v == 1) {
        another_sig.unshift(0);
        ++another_v;
        another_exp += Decimal.decimal_digits_per_word;
    }

    var result_len = Decimal.n + 2;
    var result_sig = Array(result_len);

    for (var i = 0; i < result_len; ++i) {
        result_sig[i] = 0;
    }

    var result_v = 0;

    for (var i = 0; i < result_len; ++i) {
        var ind = this_v - i - 1;
        var tmp1 = this_sig[ind];

        if (i) {
            tmp1 += this_sig[ind + 1] * Decimal.one_word;
        }

        var result = Math.floor(tmp1 / another_sig[another_v - 1]);

        var tmp2 = ((tmp1 - another_sig[another_v - 1] * result) *
                    Decimal.one_word + this_sig[ind - 1] +
                    (Decimal.two_words - another_sig[another_v - 2] * result));

        if (tmp2 < Decimal.two_words) {
            result -= Math.floor((Decimal.two_words - 1 - tmp2) /
                                 (another_sig[another_v - 1]
                                  * Decimal.one_word +
                                  another_sig[another_v - 2])) + 1;
        }

        // multiply and subtract
        var carry = Decimal.one_word;
        for (var j = 0; j < another_v + 1; ++j) {
            var ind2 = (added - i + j - 
                        (Decimal.n - (this_v - added)) +
                        (Decimal.n - another_v));

            if (ind2 >= this_v) {
                break;
            }

            this_sig[ind2] += (Decimal.two_words - Decimal.one_word + carry);

            if (j < another_v) {
                this_sig[ind2] -= another_sig[j] * result;
            }

            carry = Math.floor(this_sig[ind2] / Decimal.one_word);
            this_sig[ind2] %= Decimal.one_word;
        }

        if (carry < Decimal.one_word) {
            // subtracted too much, add back
            result -= 1;
            carry = 0;

            for (j = 0; j < another_v; ++j) {
                var ind2 = this_v - i - another_v + j;
                this_sig[ind2] += carry + another_sig[j];
                carry = Math.floor(this_sig[ind2] / Decimal.one_word);
                this_sig[ind2] %= Decimal.one_word;
            }
        }
        result_sig[result_len - 1 - i] = result;

        // increment valid_words of the result
        if (result || result_v) {
            ++result_v;
        }

        // stop if we've computed enough words
        if (result_v > Decimal.n) {
            break;
        }
    }
    // if the remainder isn't zero, add one to the result
    // in order to prevent an erroneous round off
    for (var i = 0; i < this_sig.length; ++i) {
        if (this_sig[i]) {
            result_sig[0] += 1;
            break;
        }
    }

    var result_exp = (this.exp - another_decimal.exp +
                      (another_v - (this_v - added) + Decimal.n + 1) *
                      Decimal.decimal_digits_per_word);

    return Decimal.fromData(result_sig, result_exp,
                             this.is_minus != another_decimal.is_minus);
};
console.log("(new Decimal(\"-0\")).toString() == \"0\": " + ((new Decimal("-0")).toString() == "0" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.3\")).sub((new Decimal(\"0.1\")).mul(3)).toString() == \"0\": " + ((new Decimal("0.3")).sub((new Decimal("0.1")).mul(3)).toString() == "0" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9999999999999999999999999999\")).add(\"1\").toString() == \"10000000000000000000000000000\": " + ((new Decimal("9999999999999999999999999999")).add("1").toString() == "10000000000000000000000000000" ? "OK" : "FAILED"));
console.log("(new Decimal(\"-9999999999999999999999999999\")).sub(\"1\").toString() == \"-10000000000000000000000000000\": " + ((new Decimal("-9999999999999999999999999999")).sub("1").toString() == "-10000000000000000000000000000" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"1.5\"), 0, Decimal.MidpointRounding.ToEven)).toString() == \"2\": " + ((Decimal.round(new Decimal("1.5"), 0, Decimal.MidpointRounding.ToEven)).toString() == "2" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"2.5\"), 0, Decimal.MidpointRounding.ToEven)).toString() == \"2\": " + ((Decimal.round(new Decimal("2.5"), 0, Decimal.MidpointRounding.ToEven)).toString() == "2" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"2.5\"), 0, Decimal.MidpointRounding.AwayFromZero)).toString() == \"3\": " + ((Decimal.round(new Decimal("2.5"), 0, Decimal.MidpointRounding.AwayFromZero)).toString() == "3" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"3.5\"), 0, Decimal.MidpointRounding.ToEven)).toString() == \"4\": " + ((Decimal.round(new Decimal("3.5"), 0, Decimal.MidpointRounding.ToEven)).toString() == "4" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"0.0000000000000000000000000015\"), 27, Decimal.MidpointRounding.ToEven)).toString() == \"0.000000000000000000000000002\": " + ((Decimal.round(new Decimal("0.0000000000000000000000000015"), 27, Decimal.MidpointRounding.ToEven)).toString() == "0.000000000000000000000000002" ? "OK" : "FAILED"));
console.log("(Decimal.round(new Decimal(\"0.0000000000000000000015\"), 21, Decimal.MidpointRounding.ToEven)).toString() == \"0.000000000000000000002\": " + ((Decimal.round(new Decimal("0.0000000000000000000015"), 21, Decimal.MidpointRounding.ToEven)).toString() == "0.000000000000000000002" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4176.15752861656\")).sub(\"0.0000897357139222956\").toString() == \"4176.1574388808460777044\": " + ((new Decimal("4176.15752861656")).sub("0.0000897357139222956").toString() == "4176.1574388808460777044" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008487069606076\")).div(\"950363559159620\").toString() == \"0.0000000000000000000000893034\": " + ((new Decimal("0.00000008487069606076")).div("950363559159620").toString() == "0.0000000000000000000000893034" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000360056907106217\")).add(\"0.0445777993856826\").toString() == \"0.0446138050763932217\": " + ((new Decimal("0.0000360056907106217")).add("0.0445777993856826").toString() == "0.0446138050763932217" ? "OK" : "FAILED"));
console.log("(new Decimal(\"264385997906.507\")).div(\"693605223062.264\").toString() == \"0.3811764806776453983061876207\": " + ((new Decimal("264385997906.507")).div("693605223062.264").toString() == "0.3811764806776453983061876207" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000734869245782\")).add(\"59.8040805942398\").toString() == \"59.80408060158849245782\": " + ((new Decimal("0.00000000734869245782")).add("59.8040805942398").toString() == "59.80408060158849245782" ? "OK" : "FAILED"));
console.log("(new Decimal(\"81663498.9723859\")).add(\"0.000463938663929672\").toString() == \"81663498.972849838663929672\": " + ((new Decimal("81663498.9723859")).add("0.000463938663929672").toString() == "81663498.972849838663929672" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00775515796977801\")).add(\"0.00000000000000091822\").toString() == \"0.00775515796977892822\": " + ((new Decimal("0.00775515796977801")).add("0.00000000000000091822").toString() == "0.00775515796977892822" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000016207366118304\")).div(\"0.00000007694176965251\").toString() == \"2.106445717521299839885103779\": " + ((new Decimal("0.00000016207366118304")).div("0.00000007694176965251").toString() == "2.106445717521299839885103779" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008179731703447\")).div(\"349415.71827485\").toString() == \"0.0000000000002340974167914459\": " + ((new Decimal("0.00000008179731703447")).div("349415.71827485").toString() == "0.0000000000002340974167914459" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0059732997352133\")).div(\"26.029864524505\").toString() == \"0.0002294787101020031897957214\": " + ((new Decimal("0.0059732997352133")).div("26.029864524505").toString() == "0.0002294787101020031897957214" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000006466138947972\")).add(\"418.23899066925\").toString() == \"418.23899073391138947972\": " + ((new Decimal("0.00000006466138947972")).add("418.23899066925").toString() == "418.23899073391138947972" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000034492730644761\")).mul(\"38243.1778303549\").toString() == \"0.0131911163190212695095445568\": " + ((new Decimal("0.00000034492730644761")).mul("38243.1778303549").toString() == "0.0131911163190212695095445568" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9114466.44883345\")).sub(\"0.00969096129745755\").toString() == \"9114466.43914248870254245\": " + ((new Decimal("9114466.44883345")).sub("0.00969096129745755").toString() == "9114466.43914248870254245" ? "OK" : "FAILED"));
console.log("(new Decimal(\"86700.1936243382\")).div(\"799513.943400008\").toString() == \"0.1084411276877017282935587367\": " + ((new Decimal("86700.1936243382")).div("799513.943400008").toString() == "0.1084411276877017282935587367" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7026.76950349788\")).sub(\"0.00021914021029097\").toString() == \"7026.76928435766970903\": " + ((new Decimal("7026.76950349788")).sub("0.00021914021029097").toString() == "7026.76928435766970903" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000857409563314826\")).div(\"0.0000890714030196291\").toString() == \"0.096260924858888151563666271\": " + ((new Decimal("0.00000857409563314826")).div("0.0000890714030196291").toString() == "0.096260924858888151563666271" ? "OK" : "FAILED"));
console.log("(new Decimal(\"514.340747387307\")).div(\"633743.414950438\").toString() == \"0.0008115914662837657985794708\": " + ((new Decimal("514.340747387307")).div("633743.414950438").toString() == "0.0008115914662837657985794708" ? "OK" : "FAILED"));
console.log("(new Decimal(\"36636.1514835787\")).div(\"9.88771142432825\").toString() == \"3705.220542079855642544922171\": " + ((new Decimal("36636.1514835787")).div("9.88771142432825").toString() == "3705.220542079855642544922171" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000196286755705386\")).add(\"6218044.09949949\").toString() == \"6218044.0995191186755705386\": " + ((new Decimal("0.0000196286755705386")).add("6218044.09949949").toString() == "6218044.0995191186755705386" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9271557.35402906\")).mul(\"585175.293770235\").toString() == \"5425486298351.537894595153029\": " + ((new Decimal("9271557.35402906")).mul("585175.293770235").toString() == "5425486298351.537894595153029" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000630784588228345\")).mul(\"42571.5710234696\").toString() == \"0.2685349089827301535187896581\": " + ((new Decimal("0.00000630784588228345")).mul("42571.5710234696").toString() == "0.2685349089827301535187896581" ? "OK" : "FAILED"));
console.log("(new Decimal(\"79.3662822709262\")).div(\"8828.00361552648\").toString() == \"0.008990286561656895507628185\": " + ((new Decimal("79.3662822709262")).div("8828.00361552648").toString() == "0.008990286561656895507628185" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000195716225633266\")).mul(\"0.00834448890217789\").toString() == \"0.0000016331518727729320183918\": " + ((new Decimal("0.000195716225633266")).mul("0.00834448890217789").toString() == "0.0000016331518727729320183918" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1806435.33906268\")).div(\"666947.141600282\").toString() == \"2.708513503376436390130932447\": " + ((new Decimal("1806435.33906268")).div("666947.141600282").toString() == "2.708513503376436390130932447" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000625330349722\")).div(\"248.114362008923\").toString() == \"0.0000000000252033112738355342\": " + ((new Decimal("0.00000000625330349722")).div("248.114362008923").toString() == "0.0000000000252033112738355342" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8526.34712985081\")).mul(\"0.0236233102267717\").toString() == \"201.4205433496101718074889301\": " + ((new Decimal("8526.34712985081")).mul("0.0236233102267717").toString() == "201.4205433496101718074889301" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.859148376090055\")).add(\"9.89508814639183\").toString() == \"10.754236522481885\": " + ((new Decimal("0.859148376090055")).add("9.89508814639183").toString() == "10.754236522481885" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000334460014633117\")).mul(\"0.00000078994461744556\").toString() == \"0.0000000000264204888310194008\": " + ((new Decimal("0.0000334460014633117")).mul("0.00000078994461744556").toString() == "0.0000000000264204888310194008" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007144519755218\")).mul(\"0.00155083385834044\").toString() == \"0.0000000001107996313797422688\": " + ((new Decimal("0.00000007144519755218")).mul("0.00155083385834044").toString() == "0.0000000001107996313797422688" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.911257319576692\")).add(\"25825.2589152312\").toString() == \"25826.170172550776692\": " + ((new Decimal("0.911257319576692")).add("25825.2589152312").toString() == "25826.170172550776692" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000942942031166955\")).mul(\"60940.2033318487\").toString() == \"0.5746307910946065180997849971\": " + ((new Decimal("0.00000942942031166955")).mul("60940.2033318487").toString() == "0.5746307910946065180997849971" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00613527925970744\")).sub(\"7131030.09254254\").toString() == \"-7131030.08640726074029256\": " + ((new Decimal("0.00613527925970744")).sub("7131030.09254254").toString() == "-7131030.08640726074029256" ? "OK" : "FAILED"));
console.log("(new Decimal(\"19833.5587139398\")).mul(\"6854768.17044186\").toString() == \"135954446978.90433258950744\": " + ((new Decimal("19833.5587139398")).mul("6854768.17044186").toString() == "135954446978.90433258950744" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000070385779892274\")).mul(\"0.00000002614391908336\").toString() == \"0.000000000000018401601341228\": " + ((new Decimal("0.00000070385779892274")).mul("0.00000002614391908336").toString() == "0.000000000000018401601341228" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0966366946681574\")).add(\"0.0000957956121283563\").toString() == \"0.0967324902802857563\": " + ((new Decimal("0.0966366946681574")).add("0.0000957956121283563").toString() == "0.0967324902802857563" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000390598294507059\")).mul(\"89243.1006251104\").toString() == \"3.485820290068997316152545431\": " + ((new Decimal("0.0000390598294507059")).mul("89243.1006251104").toString() == "3.485820290068997316152545431" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.343008653886155\")).sub(\"0.0433969528150731\").toString() == \"0.2996117010710819\": " + ((new Decimal("0.343008653886155")).sub("0.0433969528150731").toString() == "0.2996117010710819" ? "OK" : "FAILED"));
console.log("(new Decimal(\"675939.590519266\")).mul(\"1508366.34054238\").toString() == \"1019564526579.260071012279493\": " + ((new Decimal("675939.590519266")).mul("1508366.34054238").toString() == "1019564526579.260071012279493" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9346774.15031324\")).div(\"0.00000079878053292575\").toString() == \"11701304382166.336357593545\": " + ((new Decimal("9346774.15031324")).div("0.00000079878053292575").toString() == "11701304382166.336357593545" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.8043270324377\")).add(\"18.0544005325317\").toString() == \"18.8587275649694\": " + ((new Decimal("0.8043270324377")).add("18.0544005325317").toString() == "18.8587275649694" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8283.88977715927\")).div(\"22916.0782987792\").toString() == \"0.3614881075703330391274611142\": " + ((new Decimal("8283.88977715927")).div("22916.0782987792").toString() == "0.3614881075703330391274611142" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000051464565215383\")).mul(\"3480.80748388581\").toString() == \"0.0179138243756634479624427415\": " + ((new Decimal("0.0000051464565215383")).mul("3480.80748388581").toString() == "0.0179138243756634479624427415" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3232.22058975707\")).sub(\"91.1747627850504\").toString() == \"3141.0458269720196\": " + ((new Decimal("3232.22058975707")).sub("91.1747627850504").toString() == "3141.0458269720196" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0490677212593461\")).add(\"0.000225615629100062\").toString() == \"0.049293336888446162\": " + ((new Decimal("0.0490677212593461")).add("0.000225615629100062").toString() == "0.049293336888446162" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.802657312156007\")).mul(\"0.00000030195741742009\").toString() == \"0.0000002423683290519788850175\": " + ((new Decimal("0.802657312156007")).mul("0.00000030195741742009").toString() == "0.0000002423683290519788850175" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.205025212003396\")).add(\"0.0869051087121037\").toString() == \"0.2919303207154997\": " + ((new Decimal("0.205025212003396")).add("0.0869051087121037").toString() == "0.2919303207154997" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000560349217411293\")).sub(\"2406054.49416025\").toString() == \"-2406054.4941042150782588707\": " + ((new Decimal("0.0000560349217411293")).sub("2406054.49416025").toString() == "-2406054.4941042150782588707" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5.51880703099016\")).sub(\"5980729.00715318\").toString() == \"-5980723.48834614900984\": " + ((new Decimal("5.51880703099016")).sub("5980729.00715318").toString() == "-5980723.48834614900984" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000517838589156903\")).add(\"35.1224282919999\").toString() == \"35.122946130589056903\": " + ((new Decimal("0.000517838589156903")).add("35.1224282919999").toString() == "35.122946130589056903" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1.59909562747883\")).div(\"1.50625102292106\").toString() == \"1.061639529630139095659225441\": " + ((new Decimal("1.59909562747883")).div("1.50625102292106").toString() == "1.061639529630139095659225441" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0037773409643105\")).div(\"88194.4215335857\").toString() == \"0.000000042829703949835811464\": " + ((new Decimal("0.0037773409643105")).div("88194.4215335857").toString() == "0.000000042829703949835811464" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000338279696804602\")).mul(\"13474.6391854597\").toString() == \"0.4558196858208716574150445539\": " + ((new Decimal("0.0000338279696804602")).mul("13474.6391854597").toString() == "0.4558196858208716574150445539" ? "OK" : "FAILED"));
console.log("(new Decimal(\"929163.589109277\")).div(\"0.0000891086495896376\").toString() == \"10427310854.65051157054264754\": " + ((new Decimal("929163.589109277")).div("0.0000891086495896376").toString() == "10427310854.65051157054264754" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000743901701990469\")).add(\"0.00000093878122416268\").toString() == \"0.00007532895142320958\": " + ((new Decimal("0.0000743901701990469")).add("0.00000093878122416268").toString() == "0.00007532895142320958" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000944754593514258\")).mul(\"2804.00093309768\").toString() == \"0.0264909276176229880949718672\": " + ((new Decimal("0.00000944754593514258")).mul("2804.00093309768").toString() == "0.0264909276176229880949718672" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000534158644049502\")).add(\"6656977.02982322\").toString() == \"6656977.0298766358644049502\": " + ((new Decimal("0.0000534158644049502")).add("6656977.02982322").toString() == "6656977.0298766358644049502" ? "OK" : "FAILED"));
console.log("(new Decimal(\"45.0619251211462\")).add(\"0.00000027082326555197\").toString() == \"45.06192539196946555197\": " + ((new Decimal("45.0619251211462")).add("0.00000027082326555197").toString() == "45.06192539196946555197" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0192431670703195\")).mul(\"39.1437204736954\").toString() == \"0.7532491528292065411818236803\": " + ((new Decimal("0.0192431670703195")).mul("39.1437204736954").toString() == "0.7532491528292065411818236803" ? "OK" : "FAILED"));
console.log("(new Decimal(\"32841.4226569428\")).add(\"0.00000007826787944802\").toString() == \"32841.42265702106787944802\": " + ((new Decimal("32841.4226569428")).add("0.00000007826787944802").toString() == "32841.42265702106787944802" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.586064839077212\")).sub(\"1.11961149197054\").toString() == \"-0.533546652893328\": " + ((new Decimal("0.586064839077212")).sub("1.11961149197054").toString() == "-0.533546652893328" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0829612452457479\")).div(\"5.43503747574754\").toString() == \"0.0152641533045431917355310935\": " + ((new Decimal("0.0829612452457479")).div("5.43503747574754").toString() == "0.0152641533045431917355310935" ? "OK" : "FAILED"));
console.log("(new Decimal(\"20551.2384514097\")).mul(\"0.0001011830145033\").toString() == \"2.07943625828976430743030201\": " + ((new Decimal("20551.2384514097")).mul("0.0001011830145033").toString() == "2.07943625828976430743030201" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000928487284541\")).add(\"0.00200241563469284\").toString() == \"0.00200242491956568541\": " + ((new Decimal("0.00000000928487284541")).add("0.00200241563469284").toString() == "0.00200242491956568541" ? "OK" : "FAILED"));
console.log("(new Decimal(\"27474.8214182792\")).sub(\"0.00000008118263398352\").toString() == \"27474.82141819801736601648\": " + ((new Decimal("27474.8214182792")).sub("0.00000008118263398352").toString() == "27474.82141819801736601648" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6414.16630540703\")).mul(\"3040.9451727946\").toString() == \"19505128.06392928191963558604\": " + ((new Decimal("6414.16630540703")).mul("3040.9451727946").toString() == "19505128.06392928191963558604" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000801082840562\")).mul(\"0.00000264348146628751\").toString() == \"0.000000000000021176476419866\": " + ((new Decimal("0.00000000801082840562")).mul("0.00000264348146628751").toString() == "0.000000000000021176476419866" ? "OK" : "FAILED"));
console.log("(new Decimal(\"29310.7074821883\")).add(\"0.0000001038281587436\").toString() == \"29310.7074822921281587436\": " + ((new Decimal("29310.7074821883")).add("0.0000001038281587436").toString() == "29310.7074822921281587436" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1.61116872989161\")).add(\"617350.037497166\").toString() == \"617351.64866589589161\": " + ((new Decimal("1.61116872989161")).add("617350.037497166").toString() == "617351.64866589589161" ? "OK" : "FAILED"));
console.log("(new Decimal(\"337234.288611093\")).sub(\"0.764276041073853\").toString() == \"337233.524335051926147\": " + ((new Decimal("337234.288611093")).sub("0.764276041073853").toString() == "337233.524335051926147" ? "OK" : "FAILED"));
console.log("(new Decimal(\"32138.4941377391\")).div(\"4179.03939456634\").toString() == \"7.690402291858299138596005029\": " + ((new Decimal("32138.4941377391")).div("4179.03939456634").toString() == "7.690402291858299138596005029" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007299932379881\")).mul(\"65129.6861773029\").toString() == \"0.0047544230501718142812280295\": " + ((new Decimal("0.00000007299932379881")).mul("65129.6861773029").toString() == "0.0047544230501718142812280295" ? "OK" : "FAILED"));
console.log("(new Decimal(\"61.8418688242519\")).mul(\"2.86489873792273\").toString() == \"177.1706919453822909000522557\": " + ((new Decimal("61.8418688242519")).mul("2.86489873792273").toString() == "177.1706919453822909000522557" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000015291550483225\")).sub(\"0.000906486652747955\").toString() == \"-0.00090633373724312275\": " + ((new Decimal("0.00000015291550483225")).sub("0.000906486652747955").toString() == "-0.00090633373724312275" ? "OK" : "FAILED"));
console.log("(new Decimal(\"201009.576768153\")).div(\"0.0009534918754145\").toString() == \"210814147.3998092914035361326\": " + ((new Decimal("201009.576768153")).div("0.0009534918754145").toString() == "210814147.3998092914035361326" ? "OK" : "FAILED"));
console.log("(new Decimal(\"61261.8303211694\")).div(\"938.078568288162\").toString() == \"65.30564964612942035221089709\": " + ((new Decimal("61261.8303211694")).div("938.078568288162").toString() == "65.30564964612942035221089709" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000743901346690907\")).mul(\"0.0762256538850375\").toString() == \"0.0000567043665774743633592246\": " + ((new Decimal("0.000743901346690907")).mul("0.0762256538850375").toString() == "0.0000567043665774743633592246" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000023104058123708\")).sub(\"0.0523044414130526\").toString() == \"-0.05230421037247136292\": " + ((new Decimal("0.00000023104058123708")).sub("0.0523044414130526").toString() == "-0.05230421037247136292" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000172902369020927\")).add(\"0.00000001833752450456\").toString() == \"0.00017292070654543156\": " + ((new Decimal("0.000172902369020927")).add("0.00000001833752450456").toString() == "0.00017292070654543156" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3255426.24725747\")).mul(\"43.9850934985956\").toString() == \"143190227.8634020159017966091\": " + ((new Decimal("3255426.24725747")).mul("43.9850934985956").toString() == "143190227.8634020159017966091" ? "OK" : "FAILED"));
console.log("(new Decimal(\"21.2078276654742\")).mul(\"0.00790728710960005\").toString() == \"0.1676963823218234630227555937\": " + ((new Decimal("21.2078276654742")).mul("0.00790728710960005").toString() == "0.1676963823218234630227555937" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4188316.9832585\")).div(\"0.00000006924077173194\").toString() == \"60489172470134.03565668114732\": " + ((new Decimal("4188316.9832585")).div("0.00000006924077173194").toString() == "60489172470134.03565668114732" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000895273411132057\")).mul(\"0.00000355532511768645\").toString() == \"0.0000000000318298804579463009\": " + ((new Decimal("0.00000895273411132057")).mul("0.00000355532511768645").toString() == "0.0000000000318298804579463009" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007554147973449\")).div(\"0.00840014314204461\").toString() == \"0.0000089928800565775915465556\": " + ((new Decimal("0.00000007554147973449")).div("0.00840014314204461").toString() == "0.0000089928800565775915465556" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1970.18939162148\")).mul(\"0.000441783528980698\").toString() == \"0.870397222190871870965842193\": " + ((new Decimal("1970.18939162148")).mul("0.000441783528980698").toString() == "0.870397222190871870965842193" ? "OK" : "FAILED"));
console.log("(new Decimal(\"85093.5901911434\")).mul(\"0.00000000522986804379\").toString() == \"0.0004450282480720230655413695\": " + ((new Decimal("85093.5901911434")).mul("0.00000000522986804379").toString() == "0.0004450282480720230655413695" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000063867933891652\")).div(\"0.21724630157335\").toString() == \"0.0000029398859004321386304627\": " + ((new Decimal("0.00000063867933891652")).div("0.21724630157335").toString() == "0.0000029398859004321386304627" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1174.96172020909\")).div(\"0.00000004214281371894\").toString() == \"27880476326.16978724375834045\": " + ((new Decimal("1174.96172020909")).div("0.00000004214281371894").toString() == "27880476326.16978724375834045" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000293723326313181\")).add(\"3.94358984843995\").toString() == \"3.943883571766263181\": " + ((new Decimal("0.000293723326313181")).add("3.94358984843995").toString() == "3.943883571766263181" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8807.4719481205\")).mul(\"0.00000682367803846657\").toString() == \"0.0600993529068002334144135817\": " + ((new Decimal("8807.4719481205")).mul("0.00000682367803846657").toString() == "0.0600993529068002334144135817" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000003024844593846\")).div(\"701.660730737103\").toString() == \"0.0000000000431097888386651556\": " + ((new Decimal("0.00000003024844593846")).div("701.660730737103").toString() == "0.0000000000431097888386651556" ? "OK" : "FAILED"));
console.log("(new Decimal(\"399059.695377508\")).add(\"0.522320054714717\").toString() == \"399060.217697562714717\": " + ((new Decimal("399059.695377508")).add("0.522320054714717").toString() == "399060.217697562714717" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000555624811237503\")).div(\"0.0461202287329921\").toString() == \"0.0012047312567642078041930781\": " + ((new Decimal("0.0000555624811237503")).div("0.0461202287329921").toString() == "0.0012047312567642078041930781" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000795415484716844\")).sub(\"0.00000008580136140147\").toString() == \"0.00079532968335544253\": " + ((new Decimal("0.000795415484716844")).sub("0.00000008580136140147").toString() == "0.00079532968335544253" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000000384458527148\")).mul(\"0.00000008123704529425\").toString() == \"0.0000000000000031232274783683\": " + ((new Decimal("0.0000000384458527148")).mul("0.00000008123704529425").toString() == "0.0000000000000031232274783683" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.10522364224551\")).sub(\"0.00872353816345499\").toString() == \"7.09650010408205501\": " + ((new Decimal("7.10522364224551")).sub("0.00872353816345499").toString() == "7.09650010408205501" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000104549135595816\")).mul(\"764.66297067919\").toString() == \"0.0007994485260663810953884227\": " + ((new Decimal("0.00000104549135595816")).mul("764.66297067919").toString() == "0.0007994485260663810953884227" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00005906747824469\")).add(\"0.00000051611592877475\").toString() == \"0.00005958359417346475\": " + ((new Decimal("0.00005906747824469")).add("0.00000051611592877475").toString() == "0.00005958359417346475" ? "OK" : "FAILED"));
console.log("(new Decimal(\"23.9156692400182\")).sub(\"0.931535637439944\").toString() == \"22.984133602578256\": " + ((new Decimal("23.9156692400182")).sub("0.931535637439944").toString() == "22.984133602578256" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.847812742389651\")).add(\"9043.52894473985\").toString() == \"9044.376757482239651\": " + ((new Decimal("0.847812742389651")).add("9043.52894473985").toString() == "9044.376757482239651" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00575696487713464\")).div(\"0.000947768283052262\").toString() == \"6.074232468082273294170875133\": " + ((new Decimal("0.00575696487713464")).div("0.000947768283052262").toString() == "6.074232468082273294170875133" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1.5620848031538\")).add(\"6530596.94288792\").toString() == \"6530598.5049727231538\": " + ((new Decimal("1.5620848031538")).add("6530596.94288792").toString() == "6530598.5049727231538" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.828937773047452\")).add(\"0.00134658593281479\").toString() == \"0.83028435898026679\": " + ((new Decimal("0.828937773047452")).add("0.00134658593281479").toString() == "0.83028435898026679" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.376231768343706\")).add(\"325484.145118615\").toString() == \"325484.521350383343706\": " + ((new Decimal("0.376231768343706")).add("325484.145118615").toString() == "325484.521350383343706" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000590405144537988\")).div(\"75955.4411638321\").toString() == \"0.0000000000777304608453940168\": " + ((new Decimal("0.00000590405144537988")).div("75955.4411638321").toString() == "0.0000000000777304608453940168" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3653.47703623282\")).mul(\"3403514.0291804\").toString() == \"12434660348.10683143756818073\": " + ((new Decimal("3653.47703623282")).mul("3403514.0291804").toString() == "12434660348.10683143756818073" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00173078235319386\")).sub(\"9833.9588427143\").toString() == \"-9833.95711193194680614\": " + ((new Decimal("0.00173078235319386")).sub("9833.9588427143").toString() == "-9833.95711193194680614" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00744602976247949\")).div(\"4.80871846191991\").toString() == \"0.0015484436906515457496509768\": " + ((new Decimal("0.00744602976247949")).div("4.80871846191991").toString() == "0.0015484436906515457496509768" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000004717649661339\")).sub(\"0.000525507920200707\").toString() == \"-0.00052546074370409361\": " + ((new Decimal("0.00000004717649661339")).sub("0.000525507920200707").toString() == "-0.00052546074370409361" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00714523922984732\")).add(\"0.00000054619227328626\").toString() == \"0.00714578542212060626\": " + ((new Decimal("0.00714523922984732")).add("0.00000054619227328626").toString() == "0.00714578542212060626" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.597390746975965\")).div(\"0.00000005021586550875\").toString() == \"11896454.25651124195510533684\": " + ((new Decimal("0.597390746975965")).div("0.00000005021586550875").toString() == "11896454.25651124195510533684" ? "OK" : "FAILED"));
console.log("(new Decimal(\"363.565448840878\")).add(\"0.871826206739911\").toString() == \"364.437275047617911\": " + ((new Decimal("363.565448840878")).add("0.871826206739911").toString() == "364.437275047617911" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.932537071375426\")).div(\"63126.5382110731\").toString() == \"0.0000147725045250754551933182\": " + ((new Decimal("0.932537071375426")).div("63126.5382110731").toString() == "0.0000147725045250754551933182" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000505016916666653\")).mul(\"854.442187517156\").toString() == \"0.4315077590098242678457705989\": " + ((new Decimal("0.000505016916666653")).mul("854.442187517156").toString() == "0.4315077590098242678457705989" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000767397499069291\")).div(\"0.00000001859306950057\").toString() == \"412.7330880174277915666407937\": " + ((new Decimal("0.00000767397499069291")).div("0.00000001859306950057").toString() == "412.7330880174277915666407937" ? "OK" : "FAILED"));
console.log("(new Decimal(\"48.1948680468811\")).div(\"9.84477093436046\").toString() == \"4.895478865706280097798313514\": " + ((new Decimal("48.1948680468811")).div("9.84477093436046").toString() == "4.895478865706280097798313514" ? "OK" : "FAILED"));
console.log("(new Decimal(\"35741.8810649504\")).div(\"5547876.0486226\").toString() == \"0.0064424440545718793484521534\": " + ((new Decimal("35741.8810649504")).div("5547876.0486226").toString() == "0.0064424440545718793484521534" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000038441831869279\")).sub(\"7840059.26355722\").toString() == \"-7840059.26355683558168130721\": " + ((new Decimal("0.00000038441831869279")).sub("7840059.26355722").toString() == "-7840059.26355683558168130721" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.58575165205903\")).mul(\"0.00000177766015370267\").toString() == \"0.0000010412673718308481481839\": " + ((new Decimal("0.58575165205903")).mul("0.00000177766015370267").toString() == "0.0000010412673718308481481839" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.257475164838822\")).mul(\"0.0898555189789532\").toString() == \"0.0231355645607838738592882811\": " + ((new Decimal("0.257475164838822")).mul("0.0898555189789532").toString() == "0.0231355645607838738592882811" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.894392650525269\")).sub(\"0.00000578374248267326\").toString() == \"0.89438686678278632674\": " + ((new Decimal("0.894392650525269")).sub("0.00000578374248267326").toString() == "0.89438686678278632674" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.866065117468156\")).mul(\"389347.016527013\").toString() == \"337199.869604343589374741298\": " + ((new Decimal("0.866065117468156")).mul("389347.016527013").toString() == "337199.869604343589374741298" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6945.02700909275\")).add(\"0.00000031674904670415\").toString() == \"6945.02700940949904670415\": " + ((new Decimal("6945.02700909275")).add("0.00000031674904670415").toString() == "6945.02700940949904670415" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0701352525829036\")).sub(\"0.697171035547355\").toString() == \"-0.6270357829644514\": " + ((new Decimal("0.0701352525829036")).sub("0.697171035547355").toString() == "-0.6270357829644514" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4111897.07187558\")).div(\"0.00000087466046720495\").toString() == \"4701135155925.690591196034602\": " + ((new Decimal("4111897.07187558")).div("0.00000087466046720495").toString() == "4701135155925.690591196034602" ? "OK" : "FAILED"));
console.log("(new Decimal(\"586.657266871378\")).div(\"472.25942857203\").toString() == \"1.242235160122165356443276239\": " + ((new Decimal("586.657266871378")).div("472.25942857203").toString() == "1.242235160122165356443276239" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5794135.34411887\")).div(\"52.6341092552217\").toString() == \"110083.2791911273418396016716\": " + ((new Decimal("5794135.34411887")).div("52.6341092552217").toString() == "110083.2791911273418396016716" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.836109915671921\")).div(\"0.00000030937874238444\").toString() == \"2702544.81360892815271769274\": " + ((new Decimal("0.836109915671921")).div("0.00000030937874238444").toString() == "2702544.81360892815271769274" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00855813363034191\")).div(\"0.000895585547152714\").toString() == \"9.555908598067839268463170045\": " + ((new Decimal("0.00855813363034191")).div("0.000895585547152714").toString() == "9.555908598067839268463170045" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00800136662460927\")).add(\"0.00000004635116646362\").toString() == \"0.00800141297577573362\": " + ((new Decimal("0.00800136662460927")).add("0.00000004635116646362").toString() == "0.00800141297577573362" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000759593656174649\")).add(\"0.00000004255409214765\").toString() == \"0.00000763849065389414\": " + ((new Decimal("0.00000759593656174649")).add("0.00000004255409214765").toString() == "0.00000763849065389414" ? "OK" : "FAILED"));
console.log("(new Decimal(\"92.2359921001997\")).mul(\"93.0954611828064\").toString() == \"8586.752222221778929827646438\": " + ((new Decimal("92.2359921001997")).mul("93.0954611828064").toString() == "8586.752222221778929827646438" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1609.99809932429\")).mul(\"0.000616841483217125\").toString() == \"0.9931136155639471788378564662\": " + ((new Decimal("1609.99809932429")).mul("0.000616841483217125").toString() == "0.9931136155639471788378564662" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7466.33106724654\")).mul(\"0.000656064537193656\").toString() == \"4.89839503616771693911067595\": " + ((new Decimal("7466.33106724654")).mul("0.000656064537193656").toString() == "4.89839503616771693911067595" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5.9157444098572\")).div(\"62.9141806452135\").toString() == \"0.0940287920654541467547713549\": " + ((new Decimal("5.9157444098572")).div("62.9141806452135").toString() == "0.0940287920654541467547713549" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000478547779135\")).div(\"0.00058938144780201\").toString() == \"0.0000081194917301801093808069\": " + ((new Decimal("0.00000000478547779135")).div("0.00058938144780201").toString() == "0.0000081194917301801093808069" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.242301107962756\")).mul(\"0.00000009786564432916\").toString() == \"0.0000000237129540524444766519\": " + ((new Decimal("0.242301107962756")).mul("0.00000009786564432916").toString() == "0.0000000237129540524444766519" ? "OK" : "FAILED"));
console.log("(new Decimal(\"414250.732126763\")).mul(\"4793.94798855947\").toString() == \"1985896464.038383301905804096\": " + ((new Decimal("414250.732126763")).mul("4793.94798855947").toString() == "1985896464.038383301905804096" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2102650.26060056\")).div(\"650627.146777989\").toString() == \"3.231728450024295197320353743\": " + ((new Decimal("2102650.26060056")).div("650627.146777989").toString() == "3.231728450024295197320353743" ? "OK" : "FAILED"));
console.log("(new Decimal(\"111.791148368172\")).sub(\"5.86578702361592\").toString() == \"105.92536134455608\": " + ((new Decimal("111.791148368172")).sub("5.86578702361592").toString() == "105.92536134455608" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1.16457231397022\")).mul(\"0.751046233228895\").toString() == \"0.8746476497299917849874735069\": " + ((new Decimal("1.16457231397022")).mul("0.751046233228895").toString() == "0.8746476497299917849874735069" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000185546575666194\")).sub(\"8083400.16197572\").toString() == \"-8083400.16197386453424333806\": " + ((new Decimal("0.00000185546575666194")).sub("8083400.16197572").toString() == "-8083400.16197386453424333806" ? "OK" : "FAILED"));
console.log("(new Decimal(\"90.5140531205172\")).div(\"0.0604208461290323\").toString() == \"1498.060006098211068993204761\": " + ((new Decimal("90.5140531205172")).div("0.0604208461290323").toString() == "1498.060006098211068993204761" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000006767841650531\")).mul(\"603929.606081885\").toString() == \"0.0408729994202976123433973094\": " + ((new Decimal("0.00000006767841650531")).mul("603929.606081885").toString() == "0.0408729994202976123433973094" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000082278563073966\")).add(\"0.00000091773994868516\").toString() == \"0.00008319630302265116\": " + ((new Decimal("0.000082278563073966")).add("0.00000091773994868516").toString() == "0.00008319630302265116" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6.2219416937893\")).sub(\"0.722112387289345\").toString() == \"5.499829306499955\": " + ((new Decimal("6.2219416937893")).sub("0.722112387289345").toString() == "5.499829306499955" ? "OK" : "FAILED"));
console.log("(new Decimal(\"367.786185987194\")).sub(\"0.000050735535123728\").toString() == \"367.786135251658876272\": " + ((new Decimal("367.786185987194")).sub("0.000050735535123728").toString() == "367.786135251658876272" ? "OK" : "FAILED"));
console.log("(new Decimal(\"517330.180628845\")).div(\"50166.1384711816\").toString() == \"10.31233809088236049976787067\": " + ((new Decimal("517330.180628845")).div("50166.1384711816").toString() == "10.31233809088236049976787067" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.243327718807071\")).div(\"48030.3283073149\").toString() == \"0.0000050661264951214749723215\": " + ((new Decimal("0.243327718807071")).div("48030.3283073149").toString() == "0.0000050661264951214749723215" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005842985946612\")).sub(\"0.0000234176659134299\").toString() == \"-0.00002335923605396378\": " + ((new Decimal("0.00000005842985946612")).sub("0.0000234176659134299").toString() == "-0.00002335923605396378" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1060005.08231111\")).mul(\"691.822589697234\").toString() == \"733335461.1367018072238944697\": " + ((new Decimal("1060005.08231111")).mul("691.822589697234").toString() == "733335461.1367018072238944697" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.63294460141703\")).mul(\"66600.6326054226\").toString() == \"508358.9390965194598088219869\": " + ((new Decimal("7.63294460141703")).mul("66600.6326054226").toString() == "508358.9390965194598088219869" ? "OK" : "FAILED"));
console.log("(new Decimal(\"60437.9311485393\")).mul(\"30.2930259286859\").toString() == \"1830847.815358834211201753506\": " + ((new Decimal("60437.9311485393")).mul("30.2930259286859").toString() == "1830847.815358834211201753506" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000225892997917669\")).div(\"278626.883066551\").toString() == \"0.0000000000810736550010910727\": " + ((new Decimal("0.0000225892997917669")).div("278626.883066551").toString() == "0.0000000000810736550010910727" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007573536456364\")).add(\"77.656430461284\").toString() == \"77.65643053701936456364\": " + ((new Decimal("0.00000007573536456364")).add("77.656430461284").toString() == "77.65643053701936456364" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.293818466502157\")).mul(\"0.0845558913818355\").toString() == \"0.0248440823395338596229713692\": " + ((new Decimal("0.293818466502157")).mul("0.0845558913818355").toString() == "0.0248440823395338596229713692" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000572612989960524\")).add(\"0.00491867133179618\").toString() == \"0.00492439746169578524\": " + ((new Decimal("0.00000572612989960524")).add("0.00491867133179618").toString() == "0.00492439746169578524" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3923274.88117073\")).mul(\"3.34875253185106\").toString() == \"13138076.69146814865098679147\": " + ((new Decimal("3923274.88117073")).mul("3.34875253185106").toString() == "13138076.69146814865098679147" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000932349686013698\")).sub(\"0.0000646860495510912\").toString() == \"0.0008676636364626068\": " + ((new Decimal("0.000932349686013698")).sub("0.0000646860495510912").toString() == "0.0008676636364626068" ? "OK" : "FAILED"));
console.log("(new Decimal(\"41601.7347674825\")).sub(\"84.8997953277546\").toString() == \"41516.8349721547454\": " + ((new Decimal("41601.7347674825")).sub("84.8997953277546").toString() == "41516.8349721547454" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000371631919113748\")).add(\"0.335056352119453\").toString() == \"0.33506006843864413748\": " + ((new Decimal("0.00000371631919113748")).add("0.335056352119453").toString() == "0.33506006843864413748" ? "OK" : "FAILED"));
console.log("(new Decimal(\"873.952093941137\")).div(\"0.00403941958399463\").toString() == \"216355.8589961767217502328842\": " + ((new Decimal("873.952093941137")).div("0.00403941958399463").toString() == "216355.8589961767217502328842" ? "OK" : "FAILED"));
console.log("(new Decimal(\"278186.309746553\")).mul(\"0.000165265013540753\").toString() == \"45.97446424711618980456677441\": " + ((new Decimal("278186.309746553")).mul("0.000165265013540753").toString() == "45.97446424711618980456677441" ? "OK" : "FAILED"));
console.log("(new Decimal(\"411.883402341922\")).add(\"0.0000903521010607258\").toString() == \"411.8834926940230607258\": " + ((new Decimal("411.883402341922")).add("0.0000903521010607258").toString() == "411.8834926940230607258" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.280687715057604\")).mul(\"7163397.64984483\").toString() == \"2010677.718383955795485111587\": " + ((new Decimal("0.280687715057604")).mul("7163397.64984483").toString() == "2010677.718383955795485111587" ? "OK" : "FAILED"));
console.log("(new Decimal(\"484.96830299728\")).mul(\"0.0000553578314629187\").toString() == \"0.0268467935821811160643869611\": " + ((new Decimal("484.96830299728")).mul("0.0000553578314629187").toString() == "0.0268467935821811160643869611" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000004376192267228\")).div(\"0.00000047726483199618\").toString() == \"0.0916931643365465232681665674\": " + ((new Decimal("0.00000004376192267228")).div("0.00000047726483199618").toString() == "0.0916931643365465232681665674" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000039209536760677\")).div(\"0.000018975524706289\").toString() == \"0.0206632160994641183202944665\": " + ((new Decimal("0.00000039209536760677")).div("0.000018975524706289").toString() == "0.0206632160994641183202944665" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6198172.99591292\")).mul(\"0.000912833437748641\").toString() == \"5657.899563619984146139284342\": " + ((new Decimal("6198172.99591292")).mul("0.000912833437748641").toString() == "5657.899563619984146139284342" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.05634104416535\")).add(\"36467.2596270532\").toString() == \"36474.31596809736535\": " + ((new Decimal("7.05634104416535")).add("36467.2596270532").toString() == "36474.31596809736535" ? "OK" : "FAILED"));
console.log("(new Decimal(\"698.142959595725\")).mul(\"0.000610020111599015\").toString() == \"0.4258812461246507845677082109\": " + ((new Decimal("698.142959595725")).mul("0.000610020111599015").toString() == "0.4258812461246507845677082109" ? "OK" : "FAILED"));
console.log("(new Decimal(\"88.0442409720478\")).sub(\"3682857.31118305\").toString() == \"-3682769.2669420779522\": " + ((new Decimal("88.0442409720478")).sub("3682857.31118305").toString() == "-3682769.2669420779522" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000389968925802954\")).sub(\"8049831.49657484\").toString() == \"-8049831.4965358431074197046\": " + ((new Decimal("0.0000389968925802954")).sub("8049831.49657484").toString() == "-8049831.4965358431074197046" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000024290986184166\")).add(\"36155.6201410273\").toString() == \"36155.62014127020986184166\": " + ((new Decimal("0.00000024290986184166")).add("36155.6201410273").toString() == "36155.62014127020986184166" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3294319.65169232\")).add(\"59.150697132177\").toString() == \"3294378.802389452177\": " + ((new Decimal("3294319.65169232")).add("59.150697132177").toString() == "3294378.802389452177" ? "OK" : "FAILED"));
console.log("(new Decimal(\"29296.0378012136\")).mul(\"4322389.56648968\").toString() == \"126628888131.4529305677958756\": " + ((new Decimal("29296.0378012136")).mul("4322389.56648968").toString() == "126628888131.4529305677958756" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.7507224575387\")).add(\"7.42475726987457\").toString() == \"15.17547972741327\": " + ((new Decimal("7.7507224575387")).add("7.42475726987457").toString() == "15.17547972741327" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.762320778221973\")).add(\"0.0000150661487668129\").toString() == \"0.7623358443707398129\": " + ((new Decimal("0.762320778221973")).add("0.0000150661487668129").toString() == "0.7623358443707398129" ? "OK" : "FAILED"));
console.log("(new Decimal(\"745.766049132573\")).sub(\"31052.2192302403\").toString() == \"-30306.453181107727\": " + ((new Decimal("745.766049132573")).sub("31052.2192302403").toString() == "-30306.453181107727" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.03395124898942\")).div(\"0.0000000928410849035\").toString() == \"43450065.81065216278685168004\": " + ((new Decimal("4.03395124898942")).div("0.0000000928410849035").toString() == "43450065.81065216278685168004" ? "OK" : "FAILED"));
console.log("(new Decimal(\"89.2452192442702\")).add(\"0.474580064636925\").toString() == \"89.719799308907125\": " + ((new Decimal("89.2452192442702")).add("0.474580064636925").toString() == "89.719799308907125" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.754648202450317\")).div(\"0.00000009908595695118\").toString() == \"7616096.424462397102772638373\": " + ((new Decimal("0.754648202450317")).div("0.00000009908595695118").toString() == "7616096.424462397102772638373" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000703358706414\")).div(\"0.0000408571451161323\").toString() == \"0.0001721507228208858110900319\": " + ((new Decimal("0.00000000703358706414")).div("0.0000408571451161323").toString() == "0.0001721507228208858110900319" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008484566439169\")).mul(\"0.0000267715063070746\").toString() == \"0.0000000000022714462393900636\": " + ((new Decimal("0.00000008484566439169")).mul("0.0000267715063070746").toString() == "0.0000000000022714462393900636" ? "OK" : "FAILED"));
console.log("(new Decimal(\"753944.105819773\")).div(\"0.0000078748863646178\").toString() == \"95740315594.55587758443029373\": " + ((new Decimal("753944.105819773")).div("0.0000078748863646178").toString() == "95740315594.55587758443029373" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6.40685234982839\")).add(\"0.0000669461857839237\").toString() == \"6.4069192960141739237\": " + ((new Decimal("6.40685234982839")).add("0.0000669461857839237").toString() == "6.4069192960141739237" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7091326.72152078\")).mul(\"0.00000039104801015512\").toString() == \"2.773049203810531793690103394\": " + ((new Decimal("7091326.72152078")).mul("0.00000039104801015512").toString() == "2.773049203810531793690103394" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0150400641909987\")).mul(\"2608.05104514959\").toString() == \"39.22525513245108233097299553\": " + ((new Decimal("0.0150400641909987")).mul("2608.05104514959").toString() == "39.22525513245108233097299553" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2.48947596293384\")).add(\"0.00000117018521352214\").toString() == \"2.48947713311905352214\": " + ((new Decimal("2.48947596293384")).add("0.00000117018521352214").toString() == "2.48947713311905352214" ? "OK" : "FAILED"));
console.log("(new Decimal(\"720.791596789282\")).div(\"0.00000081820115950806\").toString() == \"880946682.1370125053482959275\": " + ((new Decimal("720.791596789282")).div("0.00000081820115950806").toString() == "880946682.1370125053482959275" ? "OK" : "FAILED"));
console.log("(new Decimal(\"378388.367769489\")).mul(\"0.000706309038543286\").toString() == \"267.2591242352310841135966009\": " + ((new Decimal("378388.367769489")).mul("0.000706309038543286").toString() == "267.2591242352310841135966009" ? "OK" : "FAILED"));
console.log("(new Decimal(\"978.517128610293\")).sub(\"33025.3582135892\").toString() == \"-32046.841084978907\": " + ((new Decimal("978.517128610293")).sub("33025.3582135892").toString() == "-32046.841084978907" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00217247345120296\")).sub(\"0.00077509415232348\").toString() == \"0.00139737929887948\": " + ((new Decimal("0.00217247345120296")).sub("0.00077509415232348").toString() == "0.00139737929887948" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000136329152219151\")).mul(\"0.0000000341309363647\").toString() == \"0.0000000000046530416190453426\": " + ((new Decimal("0.000136329152219151")).mul("0.0000000341309363647").toString() == "0.0000000000046530416190453426" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000426702743594862\")).sub(\"4850951.78934324\").toString() == \"-4850951.788916537256405138\": " + ((new Decimal("0.000426702743594862")).sub("4850951.78934324").toString() == "-4850951.788916537256405138" ? "OK" : "FAILED"));
console.log("(new Decimal(\"219.782070359114\")).div(\"0.0609157523423972\").toString() == \"3607.967757235533138165539071\": " + ((new Decimal("219.782070359114")).div("0.0609157523423972").toString() == "3607.967757235533138165539071" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9.13404255133776\")).sub(\"59587.3388273582\").toString() == \"-59578.20478480686224\": " + ((new Decimal("9.13404255133776")).sub("59587.3388273582").toString() == "-59578.20478480686224" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000786728870489974\")).div(\"0.00000010380116948104\").toString() == \"7579.190816666814701774653962\": " + ((new Decimal("0.000786728870489974")).div("0.00000010380116948104").toString() == "7579.190816666814701774653962" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000004602920037975\")).sub(\"4.198197170253\").toString() == \"-4.1981967099609962025\": " + ((new Decimal("0.0000004602920037975")).sub("4.198197170253").toString() == "-4.1981967099609962025" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000866447461706795\")).sub(\"0.00000007925082271884\").toString() == \"0.00008656549534796066\": " + ((new Decimal("0.0000866447461706795")).sub("0.00000007925082271884").toString() == "0.00008656549534796066" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000388761161541921\")).mul(\"75.5750741695869\").toString() == \"0.000293806536177854339034476\": " + ((new Decimal("0.00000388761161541921")).mul("75.5750741695869").toString() == "0.000293806536177854339034476" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0702169635660094\")).add(\"0.00000073315482434498\").toString() == \"0.07021769672083374498\": " + ((new Decimal("0.0702169635660094")).add("0.00000073315482434498").toString() == "0.07021769672083374498" ? "OK" : "FAILED"));
console.log("(new Decimal(\"274391.580035161\")).mul(\"906718.696424141\").toString() == \"248795975759.2415352177492217\": " + ((new Decimal("274391.580035161")).mul("906718.696424141").toString() == "248795975759.2415352177492217" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000067736893644434\")).mul(\"9.37717102904672\").toString() == \"0.0000063518043668020539957365\": " + ((new Decimal("0.00000067736893644434")).mul("9.37717102904672").toString() == "0.0000063518043668020539957365" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00810707191382864\")).sub(\"25.2564404743055\").toString() == \"-25.24833340239167136\": " + ((new Decimal("0.00810707191382864")).sub("25.2564404743055").toString() == "-25.24833340239167136" ? "OK" : "FAILED"));
console.log("(new Decimal(\"337218.588375123\")).div(\"0.0000009197226399182\").toString() == \"366652481671.1211686609103279\": " + ((new Decimal("337218.588375123")).div("0.0000009197226399182").toString() == "366652481671.1211686609103279" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000970961897620448\")).add(\"0.00000005671555626053\").toString() == \"0.00097101861317670853\": " + ((new Decimal("0.000970961897620448")).add("0.00000005671555626053").toString() == "0.00097101861317670853" ? "OK" : "FAILED"));
console.log("(new Decimal(\"756541.015466927\")).mul(\"9489.8766230279\").toString() == \"7179480897.041379461279048263\": " + ((new Decimal("756541.015466927")).mul("9489.8766230279").toString() == "7179480897.041379461279048263" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000264943868510865\")).sub(\"3633.63991660701\").toString() == \"-3633.6398901126231489135\": " + ((new Decimal("0.0000264943868510865")).sub("3633.63991660701").toString() == "-3633.6398901126231489135" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00587727810064204\")).sub(\"492238.584669418\").toString() == \"-492238.57879213989935796\": " + ((new Decimal("0.00587727810064204")).sub("492238.584669418").toString() == "-492238.57879213989935796" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.96619214954143\")).sub(\"0.0000254726803514514\").toString() == \"7.9661666768610785486\": " + ((new Decimal("7.96619214954143")).sub("0.0000254726803514514").toString() == "7.9661666768610785486" ? "OK" : "FAILED"));
console.log("(new Decimal(\"346273.425196425\")).div(\"311194.983455909\").toString() == \"1.11272174554666628963476869\": " + ((new Decimal("346273.425196425")).div("311194.983455909").toString() == "1.11272174554666628963476869" ? "OK" : "FAILED"));
console.log("(new Decimal(\"85.1793199242928\")).div(\"17.5742118701219\").toString() == \"4.846835838431369196375530899\": " + ((new Decimal("85.1793199242928")).div("17.5742118701219").toString() == "4.846835838431369196375530899" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.121196779478899\")).add(\"0.000260246567083637\").toString() == \"0.121457026045982637\": " + ((new Decimal("0.121196779478899")).add("0.000260246567083637").toString() == "0.121457026045982637" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00907333258496287\")).sub(\"30759.9222430773\").toString() == \"-30759.91316974471503713\": " + ((new Decimal("0.00907333258496287")).sub("30759.9222430773").toString() == "-30759.91316974471503713" ? "OK" : "FAILED"));
console.log("(new Decimal(\"906.624596988142\")).add(\"0.0000280890711248336\").toString() == \"906.6246250772131248336\": " + ((new Decimal("906.624596988142")).add("0.0000280890711248336").toString() == "906.6246250772131248336" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5976325.60691625\")).mul(\"46.7030053710113\").toString() == \"279112366.9187219909765369036\": " + ((new Decimal("5976325.60691625")).mul("46.7030053710113").toString() == "279112366.9187219909765369036" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3487.68775513754\")).sub(\"0.00285748113545472\").toString() == \"3487.68489765640454528\": " + ((new Decimal("3487.68775513754")).sub("0.00285748113545472").toString() == "3487.68489765640454528" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000475329228898198\")).div(\"1530.95402360473\").toString() == \"0.0000003104791009850215294554\": " + ((new Decimal("0.000475329228898198")).div("1530.95402360473").toString() == "0.0000003104791009850215294554" ? "OK" : "FAILED"));
console.log("(new Decimal(\"843.496774716068\")).sub(\"0.00000017341123529403\").toString() == \"843.49677454265676470597\": " + ((new Decimal("843.496774716068")).sub("0.00000017341123529403").toString() == "843.49677454265676470597" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00197717379870693\")).mul(\"13820.010895757\").toString() == \"27.32456344093503007762349601\": " + ((new Decimal("0.00197717379870693")).mul("13820.010895757").toString() == "27.32456344093503007762349601" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000708901179353195\")).div(\"53141.7806880277\").toString() == \"0.0000000133398085305956484381\": " + ((new Decimal("0.000708901179353195")).div("53141.7806880277").toString() == "0.0000000133398085305956484381" ? "OK" : "FAILED"));
console.log("(new Decimal(\"63225.9976413222\")).sub(\"0.0000763624916208733\").toString() == \"63225.9975649597083791267\": " + ((new Decimal("63225.9976413222")).sub("0.0000763624916208733").toString() == "63225.9975649597083791267" ? "OK" : "FAILED"));
console.log("(new Decimal(\"90165.3561229656\")).sub(\"0.000537267276336098\").toString() == \"90165.355585698323663902\": " + ((new Decimal("90165.3561229656")).sub("0.000537267276336098").toString() == "90165.355585698323663902" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000351506077382484\")).div(\"86065.3042728385\").toString() == \"0.0000000004084178640305073762\": " + ((new Decimal("0.0000351506077382484")).div("86065.3042728385").toString() == "0.0000000004084178640305073762" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6.36616601905141\")).sub(\"0.00000025831689371649\").toString() == \"6.36616576073451628351\": " + ((new Decimal("6.36616601905141")).sub("0.00000025831689371649").toString() == "6.36616576073451628351" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0188125421380683\")).div(\"0.00000001978560784822\").toString() == \"950819.5190354365960954329306\": " + ((new Decimal("0.0188125421380683")).div("0.00000001978560784822").toString() == "950819.5190354365960954329306" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000201579493098696\")).mul(\"6.35589887218359\").toString() == \"0.0001281218872841341670208902\": " + ((new Decimal("0.0000201579493098696")).mul("6.35589887218359").toString() == "0.0001281218872841341670208902" ? "OK" : "FAILED"));
console.log("(new Decimal(\"96670.6671736532\")).add(\"3831.01654883056\").toString() == \"100501.68372248376\": " + ((new Decimal("96670.6671736532")).add("3831.01654883056").toString() == "100501.68372248376" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6377.50250118668\")).div(\"843017.755003189\").toString() == \"0.007565086812628940345573773\": " + ((new Decimal("6377.50250118668")).div("843017.755003189").toString() == "0.007565086812628940345573773" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00984376350876119\")).mul(\"877.359488456212\").toString() == \"8.636519316530644210529680012\": " + ((new Decimal("0.00984376350876119")).mul("877.359488456212").toString() == "8.636519316530644210529680012" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9.97239828574117\")).div(\"0.00000293672959922661\").toString() == \"3395749.574072944530913664837\": " + ((new Decimal("9.97239828574117")).div("0.00000293672959922661").toString() == "3395749.574072944530913664837" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005182576428718\")).mul(\"971.10556530352\").toString() == \"0.0000503282881253889121331449\": " + ((new Decimal("0.00000005182576428718")).mul("971.10556530352").toString() == "0.0000503282881253889121331449" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1755687.77683922\")).sub(\"0.00000003924737965653\").toString() == \"1755687.77683918075262034347\": " + ((new Decimal("1755687.77683922")).sub("0.00000003924737965653").toString() == "1755687.77683918075262034347" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000688309593912358\")).mul(\"0.000969682551906296\").toString() == \"0.000000066744180352652160759\": " + ((new Decimal("0.0000688309593912358")).mul("0.000969682551906296").toString() == "0.000000066744180352652160759" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5007756.38735283\")).sub(\"0.00000933194947863554\").toString() == \"5007756.38734349805052136446\": " + ((new Decimal("5007756.38735283")).sub("0.00000933194947863554").toString() == "5007756.38734349805052136446" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8519.28502252292\")).sub(\"0.00000038752742641956\").toString() == \"8519.28502213539257358044\": " + ((new Decimal("8519.28502252292")).sub("0.00000038752742641956").toString() == "8519.28502213539257358044" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8376.9132515308\")).add(\"0.00000004663275230985\").toString() == \"8376.91325157743275230985\": " + ((new Decimal("8376.9132515308")).add("0.00000004663275230985").toString() == "8376.91325157743275230985" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0061082019266245\")).sub(\"0.00000004407663226317\").toString() == \"0.00610815784999223683\": " + ((new Decimal("0.0061082019266245")).sub("0.00000004407663226317").toString() == "0.00610815784999223683" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000091555889785083\")).sub(\"6.68580617601322\").toString() == \"-6.6857970204242414917\": " + ((new Decimal("0.0000091555889785083")).sub("6.68580617601322").toString() == "-6.6857970204242414917" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.679050468690251\")).mul(\"0.00000734519600744601\").toString() == \"0.0000049877587914779734645683\": " + ((new Decimal("0.679050468690251")).mul("0.00000734519600744601").toString() == "0.0000049877587914779734645683" ? "OK" : "FAILED"));
console.log("(new Decimal(\"72.9822536338969\")).div(\"0.0000548014413354925\").toString() == \"1331757.921969645020166511097\": " + ((new Decimal("72.9822536338969")).div("0.0000548014413354925").toString() == "1331757.921969645020166511097" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000018985219774295\")).div(\"0.000868960610064194\").toString() == \"0.0002184819375517202908665847\": " + ((new Decimal("0.00000018985219774295")).div("0.000868960610064194").toString() == "0.0002184819375517202908665847" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.31134765190601\")).sub(\"873445.700795132\").toString() == \"-873438.38944748009399\": " + ((new Decimal("7.31134765190601")).sub("873445.700795132").toString() == "-873438.38944748009399" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4389325.52672426\")).div(\"0.999372096266305\").toString() == \"4392083.332247277642826930328\": " + ((new Decimal("4389325.52672426")).div("0.999372096266305").toString() == "4392083.332247277642826930328" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3511082.54562648\")).sub(\"0.0920355470348315\").toString() == \"3511082.4535909329651685\": " + ((new Decimal("3511082.54562648")).sub("0.0920355470348315").toString() == "3511082.4535909329651685" ? "OK" : "FAILED"));
console.log("(new Decimal(\"310.688569820807\")).div(\"0.501554724528247\").toString() == \"619.4509883503437478477342908\": " + ((new Decimal("310.688569820807")).div("0.501554724528247").toString() == "619.4509883503437478477342908" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000003554128810556\")).div(\"0.00205047553034987\").toString() == \"0.0000173331929981605953452824\": " + ((new Decimal("0.00000003554128810556")).div("0.00205047553034987").toString() == "0.0000173331929981605953452824" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2197324.21086976\")).sub(\"0.00000002355746064501\").toString() == \"2197324.21086973644253935499\": " + ((new Decimal("2197324.21086976")).sub("0.00000002355746064501").toString() == "2197324.21086973644253935499" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.42253004499829\")).add(\"0.0000978712602974248\").toString() == \"4.4226279162585874248\": " + ((new Decimal("4.42253004499829")).add("0.0000978712602974248").toString() == "4.4226279162585874248" ? "OK" : "FAILED"));
console.log("(new Decimal(\"352307.698853457\")).sub(\"0.00000791750905472669\").toString() == \"352307.69884553949094527331\": " + ((new Decimal("352307.698853457")).sub("0.00000791750905472669").toString() == "352307.69884553949094527331" ? "OK" : "FAILED"));
console.log("(new Decimal(\"721.870396156735\")).mul(\"23684.1639148463\").toString() == \"17096896.78785114629132823483\": " + ((new Decimal("721.870396156735")).mul("23684.1639148463").toString() == "17096896.78785114629132823483" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000786162371181959\")).div(\"134228.236104468\").toString() == \"0.0000000058569075628029528804\": " + ((new Decimal("0.000786162371181959")).div("134228.236104468").toString() == "0.0000000058569075628029528804" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0291847988167707\")).sub(\"5591696.30780429\").toString() == \"-5591696.2786194911832293\": " + ((new Decimal("0.0291847988167707")).sub("5591696.30780429").toString() == "-5591696.2786194911832293" ? "OK" : "FAILED"));
console.log("(new Decimal(\"67027.4105235131\")).add(\"50.5608372625712\").toString() == \"67077.9713607756712\": " + ((new Decimal("67027.4105235131")).add("50.5608372625712").toString() == "67077.9713607756712" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.452668749472438\")).mul(\"0.00000009784820326504\").toString() == \"0.0000000442928238101105816891\": " + ((new Decimal("0.452668749472438")).mul("0.00000009784820326504").toString() == "0.0000000442928238101105816891" ? "OK" : "FAILED"));
console.log("(new Decimal(\"796.730048394171\")).add(\"0.00000006021631539809\").toString() == \"796.73004845438731539809\": " + ((new Decimal("796.730048394171")).add("0.00000006021631539809").toString() == "796.73004845438731539809" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00393717444219495\")).div(\"34872.2506942564\").toString() == \"0.0000001129027912971335249117\": " + ((new Decimal("0.00393717444219495")).div("34872.2506942564").toString() == "0.0000001129027912971335249117" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00680742215216505\")).mul(\"3.73675934213063\").toString() == \"0.0254376983229297496691344205\": " + ((new Decimal("0.00680742215216505")).mul("3.73675934213063").toString() == "0.0254376983229297496691344205" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000893482386550625\")).sub(\"315.51025962248\").toString() == \"-315.51025068765613449375\": " + ((new Decimal("0.00000893482386550625")).sub("315.51025962248").toString() == "-315.51025068765613449375" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000027297311009512\")).mul(\"11.0389079018677\").toString() == \"0.0003013325022026421797172656\": " + ((new Decimal("0.000027297311009512")).mul("11.0389079018677").toString() == "0.0003013325022026421797172656" ? "OK" : "FAILED"));
console.log("(new Decimal(\"54243.3473999814\")).div(\"134.653614430993\").toString() == \"402.8361780647181672179472506\": " + ((new Decimal("54243.3473999814")).div("134.653614430993").toString() == "402.8361780647181672179472506" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000021819561916319\")).mul(\"0.00000001814166820522\").toString() == \"0.0000000000000039584325266911\": " + ((new Decimal("0.00000021819561916319")).mul("0.00000001814166820522").toString() == "0.0000000000000039584325266911" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000006649979439867\")).add(\"0.0727497577074681\").toString() == \"0.07274982420726249867\": " + ((new Decimal("0.00000006649979439867")).add("0.0727497577074681").toString() == "0.07274982420726249867" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0942382432959221\")).div(\"0.000753313596711174\").toString() == \"125.0982906817938916141185787\": " + ((new Decimal("0.0942382432959221")).div("0.000753313596711174").toString() == "125.0982906817938916141185787" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000336303566739105\")).mul(\"9239.33415638252\").toString() == \"3.107221031085881207719422445\": " + ((new Decimal("0.000336303566739105")).mul("9239.33415638252").toString() == "3.107221031085881207719422445" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000296421897735643\")).sub(\"0.00000002494399572022\").toString() == \"0.00000293927498163621\": " + ((new Decimal("0.00000296421897735643")).sub("0.00000002494399572022").toString() == "0.00000293927498163621" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005236202508787\")).add(\"0.954244942848685\").toString() == \"0.95424499521071008787\": " + ((new Decimal("0.00000005236202508787")).add("0.954244942848685").toString() == "0.95424499521071008787" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.544814708896361\")).div(\"6.48559038829319\").toString() == \"0.0840038726281231661070730835\": " + ((new Decimal("0.544814708896361")).div("6.48559038829319").toString() == "0.0840038726281231661070730835" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5.92341898285012\")).sub(\"0.339034363785309\").toString() == \"5.584384619064811\": " + ((new Decimal("5.92341898285012")).sub("0.339034363785309").toString() == "5.584384619064811" ? "OK" : "FAILED"));
console.log("(new Decimal(\"761069.961246601\")).add(\"7891.63357014378\").toString() == \"768961.59481674478\": " + ((new Decimal("761069.961246601")).add("7891.63357014378").toString() == "768961.59481674478" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0057420220671883\")).div(\"0.000803649112956435\").toString() == \"7.14493673248111849623921619\": " + ((new Decimal("0.0057420220671883")).div("0.000803649112956435").toString() == "7.14493673248111849623921619" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000249094584141436\")).div(\"0.0371038709939941\").toString() == \"0.0000671343925763854248084927\": " + ((new Decimal("0.00000249094584141436")).div("0.0371038709939941").toString() == "0.0000671343925763854248084927" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3379.79016051618\")).sub(\"0.153289035965357\").toString() == \"3379.636871480214643\": " + ((new Decimal("3379.79016051618")).sub("0.153289035965357").toString() == "3379.636871480214643" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000116651752087\")).sub(\"5537047.53310282\").toString() == \"-5537047.53310281883348247913\": " + ((new Decimal("0.00000000116651752087")).sub("5537047.53310282").toString() == "-5537047.53310281883348247913" ? "OK" : "FAILED"));
console.log("(new Decimal(\"46.4980181523124\")).sub(\"165.653181805114\").toString() == \"-119.1551636528016\": " + ((new Decimal("46.4980181523124")).sub("165.653181805114").toString() == "-119.1551636528016" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7507411.17052148\")).sub(\"0.00000004087582530495\").toString() == \"7507411.17052143912417469505\": " + ((new Decimal("7507411.17052148")).sub("0.00000004087582530495").toString() == "7507411.17052143912417469505" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3680288.43481107\")).sub(\"0.0462780314713149\").toString() == \"3680288.3885330385286851\": " + ((new Decimal("3680288.43481107")).sub("0.0462780314713149").toString() == "3680288.3885330385286851" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000183056355073609\")).sub(\"0.000642630298455539\").toString() == \"-0.00064079973490480291\": " + ((new Decimal("0.00000183056355073609")).sub("0.000642630298455539").toString() == "-0.00064079973490480291" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.390304429638341\")).sub(\"2.44817468451717\").toString() == \"-2.057870254878829\": " + ((new Decimal("0.390304429638341")).sub("2.44817468451717").toString() == "-2.057870254878829" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000077470167063861\")).add(\"0.828013044236234\").toString() == \"0.82801381893790463861\": " + ((new Decimal("0.00000077470167063861")).add("0.828013044236234").toString() == "0.82801381893790463861" ? "OK" : "FAILED"));
console.log("(new Decimal(\"71.2106066156228\")).mul(\"0.000807631163302637\").toString() == \"0.0575119050604619002876486373\": " + ((new Decimal("71.2106066156228")).mul("0.000807631163302637").toString() == "0.0575119050604619002876486373" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000009483140771968\")).mul(\"0.892510451792046\").toString() == \"0.0000000846380225479673155344\": " + ((new Decimal("0.00000009483140771968")).mul("0.892510451792046").toString() == "0.0000000846380225479673155344" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2908.7434722617\")).mul(\"0.00000003684937666955\").toString() == \"0.0001071853838444661455520212\": " + ((new Decimal("2908.7434722617")).mul("0.00000003684937666955").toString() == "0.0001071853838444661455520212" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000959274857751687\")).add(\"0.00069936359659739\").toString() == \"0.001658638454349077\": " + ((new Decimal("0.000959274857751687")).add("0.00069936359659739").toString() == "0.001658638454349077" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8683.4491690078\")).mul(\"2.83754333054532\").toString() == \"24639.6632756473841088173335\": " + ((new Decimal("8683.4491690078")).mul("2.83754333054532").toString() == "24639.6632756473841088173335" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000935707818221165\")).add(\"6117906.68504215\").toString() == \"6117906.68505150707818221165\": " + ((new Decimal("0.00000935707818221165")).add("6117906.68504215").toString() == "6117906.68505150707818221165" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6641.46798972109\")).mul(\"0.000905248265669331\").toString() == \"6.012177379193394967436856891\": " + ((new Decimal("6641.46798972109")).mul("0.000905248265669331").toString() == "6.012177379193394967436856891" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000713244643860145\")).mul(\"0.14110085374727\").toString() == \"0.0000100639428179333997221056\": " + ((new Decimal("0.0000713244643860145")).mul("0.14110085374727").toString() == "0.0000100639428179333997221056" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00126479322149641\")).add(\"817567.711145416\").toString() == \"817567.71241020922149641\": " + ((new Decimal("0.00126479322149641")).add("817567.711145416").toString() == "817567.71241020922149641" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5911522.42660128\")).add(\"0.0209104741555222\").toString() == \"5911522.4475117541555222\": " + ((new Decimal("5911522.42660128")).add("0.0209104741555222").toString() == "5911522.4475117541555222" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000004386581752629\")).sub(\"50.0048079760768\").toString() == \"-50.00480793221098247371\": " + ((new Decimal("0.00000004386581752629")).sub("50.0048079760768").toString() == "-50.00480793221098247371" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000009429415883231\")).sub(\"0.00216403399229238\").toString() == \"-0.00216393969813354769\": " + ((new Decimal("0.00000009429415883231")).sub("0.00216403399229238").toString() == "-0.00216393969813354769" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007785942125034\")).add(\"149554.648040586\").toString() == \"149554.64804066385942125034\": " + ((new Decimal("0.00000007785942125034")).add("149554.648040586").toString() == "149554.64804066385942125034" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000514483727288658\")).mul(\"0.0000780548896072688\").toString() == \"0.0000000401579705382523868391\": " + ((new Decimal("0.000514483727288658")).mul("0.0000780548896072688").toString() == "0.0000000401579705382523868391" ? "OK" : "FAILED"));
console.log("(new Decimal(\"85.0879618362933\")).div(\"0.0000193752234426212\").toString() == \"4391586.093872787592004185381\": " + ((new Decimal("85.0879618362933")).div("0.0000193752234426212").toString() == "4391586.093872787592004185381" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.70885837669897\")).mul(\"0.0000000304678260025\").toString() == \"0.000000143468677691678818281\": " + ((new Decimal("4.70885837669897")).mul("0.0000000304678260025").toString() == "0.000000143468677691678818281" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000094580709000389\")).div(\"0.153855640978485\").toString() == \"0.0000061473669992779179347052\": " + ((new Decimal("0.00000094580709000389")).div("0.153855640978485").toString() == "0.0000061473669992779179347052" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000613740297785839\")).add(\"0.00270083195189984\").toString() == \"0.003314572249685679\": " + ((new Decimal("0.000613740297785839")).add("0.00270083195189984").toString() == "0.003314572249685679" ? "OK" : "FAILED"));
console.log("(new Decimal(\"68943.9000417217\")).sub(\"755.129211002555\").toString() == \"68188.770830719145\": " + ((new Decimal("68943.9000417217")).sub("755.129211002555").toString() == "68188.770830719145" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000109071683655061\")).add(\"0.0185030042745653\").toString() == \"0.0185139114429308061\": " + ((new Decimal("0.0000109071683655061")).add("0.0185030042745653").toString() == "0.0185139114429308061" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00319345103725486\")).add(\"88.6636658518872\").toString() == \"88.66685930292445486\": " + ((new Decimal("0.00319345103725486")).add("88.6636658518872").toString() == "88.66685930292445486" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000776580248855325\")).sub(\"0.00000298562437434943\").toString() == \"0.00000478017811420382\": " + ((new Decimal("0.00000776580248855325")).sub("0.00000298562437434943").toString() == "0.00000478017811420382" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.364325482567924\")).add(\"0.0216327877815966\").toString() == \"0.3859582703495206\": " + ((new Decimal("0.364325482567924")).add("0.0216327877815966").toString() == "0.3859582703495206" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000696548845943319\")).div(\"0.000648516426164897\").toString() == \"0.0107406507813914476055243271\": " + ((new Decimal("0.00000696548845943319")).div("0.000648516426164897").toString() == "0.0107406507813914476055243271" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000220559127731509\")).sub(\"73.0557600842117\").toString() == \"-73.0557380282989268491\": " + ((new Decimal("0.0000220559127731509")).sub("73.0557600842117").toString() == "-73.0557380282989268491" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000148999663139228\")).add(\"0.00000046673508475848\").toString() == \"0.00000195673171615076\": " + ((new Decimal("0.00000148999663139228")).add("0.00000046673508475848").toString() == "0.00000195673171615076" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2.074972690118\")).sub(\"840.085914284031\").toString() == \"-838.010941593913\": " + ((new Decimal("2.074972690118")).sub("840.085914284031").toString() == "-838.010941593913" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000059002973120195\")).div(\"546.800231815688\").toString() == \"0.0000000010790590363188315712\": " + ((new Decimal("0.00000059002973120195")).div("546.800231815688").toString() == "0.0000000010790590363188315712" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000004584207597461\")).mul(\"1058039.62380534\").toString() == \"0.0485027328186321794374224174\": " + ((new Decimal("0.00000004584207597461")).mul("1058039.62380534").toString() == "0.0485027328186321794374224174" ? "OK" : "FAILED"));
console.log("(new Decimal(\"214.855142037782\")).add(\"0.00000003149646582617\").toString() == \"214.85514206927846582617\": " + ((new Decimal("214.855142037782")).add("0.00000003149646582617").toString() == "214.85514206927846582617" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000824154042091292\")).div(\"5.06838559874724\").toString() == \"0.0001626068155301757850120131\": " + ((new Decimal("0.000824154042091292")).div("5.06838559874724").toString() == "0.0001626068155301757850120131" ? "OK" : "FAILED"));
console.log("(new Decimal(\"20.9787698560296\")).add(\"0.0000380000689709559\").toString() == \"20.9788078560985709559\": " + ((new Decimal("20.9787698560296")).add("0.0000380000689709559").toString() == "20.9788078560985709559" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00617890391786532\")).sub(\"81.8897506603458\").toString() == \"-81.88357175642793468\": " + ((new Decimal("0.00617890391786532")).sub("81.8897506603458").toString() == "-81.88357175642793468" ? "OK" : "FAILED"));
console.log("(new Decimal(\"36.2335875333443\")).sub(\"0.00000038898931974032\").toString() == \"36.23358714435498025968\": " + ((new Decimal("36.2335875333443")).sub("0.00000038898931974032").toString() == "36.23358714435498025968" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000000292342323946\")).mul(\"467221.476820866\").toString() == \"0.0013658861233129413838425724\": " + ((new Decimal("0.00000000292342323946")).mul("467221.476820866").toString() == "0.0013658861233129413838425724" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000342916469715031\")).div(\"46273.958751128\").toString() == \"0.0000000074105712796113834889\": " + ((new Decimal("0.000342916469715031")).div("46273.958751128").toString() == "0.0000000074105712796113834889" ? "OK" : "FAILED"));
console.log("(new Decimal(\"476.05942677523\")).sub(\"3.7360058602579\").toString() == \"472.3234209149721\": " + ((new Decimal("476.05942677523")).sub("3.7360058602579").toString() == "472.3234209149721" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9.76490417950084\")).add(\"8039016.69012337\").toString() == \"8039026.45502754950084\": " + ((new Decimal("9.76490417950084")).add("8039016.69012337").toString() == "8039026.45502754950084" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9044513.99065764\")).mul(\"4523506.43674075\").toString() == \"40912917253931.60215115068683\": " + ((new Decimal("9044513.99065764")).mul("4523506.43674075").toString() == "40912917253931.60215115068683" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000627560420254041\")).sub(\"6914.31607441712\").toString() == \"-6914.3160116610779745959\": " + ((new Decimal("0.0000627560420254041")).sub("6914.31607441712").toString() == "-6914.3160116610779745959" ? "OK" : "FAILED"));
console.log("(new Decimal(\"22.8028122907518\")).sub(\"0.000108208570214086\").toString() == \"22.802704082181585914\": " + ((new Decimal("22.8028122907518")).sub("0.000108208570214086").toString() == "22.802704082181585914" ? "OK" : "FAILED"));
console.log("(new Decimal(\"788.327495468933\")).sub(\"0.0000592008064776663\").toString() == \"788.3274362681265223337\": " + ((new Decimal("788.327495468933")).sub("0.0000592008064776663").toString() == "788.3274362681265223337" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8866.23474250838\")).div(\"5518.60868256474\").toString() == \"1.606606891791401857532489511\": " + ((new Decimal("8866.23474250838")).div("5518.60868256474").toString() == "1.606606891791401857532489511" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000009113297261816\")).add(\"26.7225435128075\").toString() == \"26.72254360394047261816\": " + ((new Decimal("0.00000009113297261816")).add("26.7225435128075").toString() == "26.72254360394047261816" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.815985052760683\")).mul(\"0.0000397454680594362\").toString() == \"0.0000324317078514770886275385\": " + ((new Decimal("0.815985052760683")).mul("0.0000397454680594362").toString() == "0.0000324317078514770886275385" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000779760512886457\")).add(\"52977.1024142285\").toString() == \"52977.103193989012886457\": " + ((new Decimal("0.000779760512886457")).add("52977.1024142285").toString() == "52977.103193989012886457" ? "OK" : "FAILED"));
console.log("(new Decimal(\"126179.391576992\")).div(\"65.9586989162297\").toString() == \"1913.006072743264578574011848\": " + ((new Decimal("126179.391576992")).div("65.9586989162297").toString() == "1913.006072743264578574011848" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000830289780548909\")).add(\"770.922592268755\").toString() == \"770.923422558535548909\": " + ((new Decimal("0.000830289780548909")).add("770.922592268755").toString() == "770.923422558535548909" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000279982820283614\")).mul(\"0.00000055934173732965\").toString() == \"0.0000000000015660607711989182\": " + ((new Decimal("0.00000279982820283614")).mul("0.00000055934173732965").toString() == "0.0000000000015660607711989182" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000015461405746388\")).add(\"0.00000007098871058365\").toString() == \"0.00000161712928522245\": " + ((new Decimal("0.0000015461405746388")).add("0.00000007098871058365").toString() == "0.00000161712928522245" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000428509554093941\")).add(\"4253730.76659335\").toString() == \"4253730.76659763509554093941\": " + ((new Decimal("0.00000428509554093941")).add("4253730.76659335").toString() == "4253730.76659763509554093941" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000074108968849345\")).add(\"0.0000887160056683775\").toString() == \"0.00008945709535687095\": " + ((new Decimal("0.00000074108968849345")).add("0.0000887160056683775").toString() == "0.00008945709535687095" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.50246398081186\")).div(\"0.0000739933611704006\").toString() == \"60849.5669015907696128142078\": " + ((new Decimal("4.50246398081186")).div("0.0000739933611704006").toString() == "60849.5669015907696128142078" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9073722.60423085\")).add(\"951749.169710907\").toString() == \"10025471.773941757\": " + ((new Decimal("9073722.60423085")).add("951749.169710907").toString() == "10025471.773941757" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6314.57190789029\")).add(\"0.00503880859121625\").toString() == \"6314.57694669888121625\": " + ((new Decimal("6314.57190789029")).add("0.00503880859121625").toString() == "6314.57694669888121625" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6410200.86892424\")).add(\"0.00000002925435156992\").toString() == \"6410200.86892426925435156992\": " + ((new Decimal("6410200.86892424")).add("0.00000002925435156992").toString() == "6410200.86892426925435156992" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000903436049774026\")).sub(\"50365.0297645317\").toString() == \"-50365.02975549733950225974\": " + ((new Decimal("0.00000903436049774026")).sub("50365.0297645317").toString() == "-50365.02975549733950225974" ? "OK" : "FAILED"));
console.log("(new Decimal(\"773516.946366763\")).sub(\"67241.9443573998\").toString() == \"706275.0020093632\": " + ((new Decimal("773516.946366763")).sub("67241.9443573998").toString() == "706275.0020093632" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000758509746174565\")).sub(\"0.000858559983716607\").toString() == \"-0.0007827090090991505\": " + ((new Decimal("0.0000758509746174565")).sub("0.000858559983716607").toString() == "-0.0007827090090991505" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0072728559734639\")).div(\"0.00000327399744804669\").toString() == \"2221.399402068251967042288701\": " + ((new Decimal("0.0072728559734639")).div("0.00000327399744804669").toString() == "2221.399402068251967042288701" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000002090733708856\")).add(\"0.00797713348547795\").toString() == \"0.00797715439281503856\": " + ((new Decimal("0.00000002090733708856")).add("0.00797713348547795").toString() == "0.00797715439281503856" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000248115556430125\")).mul(\"0.00061585812858113\").toString() == \"0.0000000152803982254922538614\": " + ((new Decimal("0.0000248115556430125")).mul("0.00061585812858113").toString() == "0.0000000152803982254922538614" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008056083325323\")).mul(\"0.000820725600617344\").toString() == \"0.0000000000661183382579908907\": " + ((new Decimal("0.00000008056083325323")).mul("0.000820725600617344").toString() == "0.0000000000661183382579908907" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000025804988167158\")).sub(\"0.0930710114040743\").toString() == \"-0.09307075335419262842\": " + ((new Decimal("0.00000025804988167158")).sub("0.0930710114040743").toString() == "-0.09307075335419262842" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0480862194896146\")).sub(\"0.00000092727159658786\").toString() == \"0.04808529221801801214\": " + ((new Decimal("0.0480862194896146")).sub("0.00000092727159658786").toString() == "0.04808529221801801214" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0380818105014422\")).add(\"19.0782681196361\").toString() == \"19.1163499301375422\": " + ((new Decimal("0.0380818105014422")).add("19.0782681196361").toString() == "19.1163499301375422" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000030766995358638\")).mul(\"9500.46112271979\").toString() == \"0.0029230064326764054146103005\": " + ((new Decimal("0.00000030766995358638")).mul("9500.46112271979").toString() == "0.0029230064326764054146103005" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8460272.38688444\")).mul(\"1.08986761937377\").toString() == \"9220576.925547387460994157139\": " + ((new Decimal("8460272.38688444")).mul("1.08986761937377").toString() == "9220576.925547387460994157139" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000548521232115348\")).sub(\"0.00000003262719848781\").toString() == \"0.00054848860491686019\": " + ((new Decimal("0.000548521232115348")).sub("0.00000003262719848781").toString() == "0.00054848860491686019" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.701377586322547\")).mul(\"0.00000005434637579804\").toString() == \"0.000000038117329882607379206\": " + ((new Decimal("0.701377586322547")).mul("0.00000005434637579804").toString() == "0.000000038117329882607379206" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6085116.43301934\")).div(\"0.00000868974698646448\").toString() == \"700263936625.2868489117465272\": " + ((new Decimal("6085116.43301934")).div("0.00000868974698646448").toString() == "700263936625.2868489117465272" ? "OK" : "FAILED"));
console.log("(new Decimal(\"64.2456262671601\")).add(\"0.00000006440493374337\").toString() == \"64.24562633156503374337\": " + ((new Decimal("64.2456262671601")).add("0.00000006440493374337").toString() == "64.24562633156503374337" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000079138978840382\")).sub(\"0.00000004250841464033\").toString() == \"0.00000074888137376349\": " + ((new Decimal("0.00000079138978840382")).sub("0.00000004250841464033").toString() == "0.00000074888137376349" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0068165044332\")).mul(\"0.963364515436517\").toString() == \"0.0065667784902605879636671644\": " + ((new Decimal("0.0068165044332")).mul("0.963364515436517").toString() == "0.0065667784902605879636671644" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.259988776529203\")).add(\"369602.172807605\").toString() == \"369602.432796381529203\": " + ((new Decimal("0.259988776529203")).add("369602.172807605").toString() == "369602.432796381529203" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000675051699706843\")).add(\"0.00393134821389399\").toString() == \"0.0039988533838646743\": " + ((new Decimal("0.0000675051699706843")).add("0.00393134821389399").toString() == "0.0039988533838646743" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8668689.53158552\")).mul(\"0.00000001357343849427\").toString() == \"0.1176639241828982721945349704\": " + ((new Decimal("8668689.53158552")).mul("0.00000001357343849427").toString() == "0.1176639241828982721945349704" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000312284355197234\")).div(\"0.000090227432870412\").toString() == \"0.3461079909540908953018615851\": " + ((new Decimal("0.0000312284355197234")).div("0.000090227432870412").toString() == "0.3461079909540908953018615851" ? "OK" : "FAILED"));
console.log("(new Decimal(\"233330.174457901\")).div(\"951.413312438602\").toString() == \"245.2458583534467888909058396\": " + ((new Decimal("233330.174457901")).div("951.413312438602").toString() == "245.2458583534467888909058396" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4790708.12686845\")).div(\"0.00287794479768628\").toString() == \"1664628220.360562025377498404\": " + ((new Decimal("4790708.12686845")).div("0.00287794479768628").toString() == "1664628220.360562025377498404" ? "OK" : "FAILED"));
console.log("(new Decimal(\"331493.556188184\")).mul(\"743.947709325677\").toString() == \"246613871.7824220865691552006\": " + ((new Decimal("331493.556188184")).mul("743.947709325677").toString() == "246613871.7824220865691552006" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1259.47609602449\")).mul(\"0.959070884603574\").toString() == \"1207.926853551263535131045527\": " + ((new Decimal("1259.47609602449")).mul("0.959070884603574").toString() == "1207.926853551263535131045527" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.393176919963759\")).add(\"0.000001917629126421\").toString() == \"0.393178837592885421\": " + ((new Decimal("0.393176919963759")).add("0.000001917629126421").toString() == "0.393178837592885421" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0851948050713142\")).add(\"397.094123250383\").toString() == \"397.1793180554543142\": " + ((new Decimal("0.0851948050713142")).add("397.094123250383").toString() == "397.1793180554543142" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.38505906815876\")).mul(\"0.0000748459692927291\").toString() == \"0.0003282039963622138325073925\": " + ((new Decimal("4.38505906815876")).mul("0.0000748459692927291").toString() == "0.0003282039963622138325073925" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.363335922995273\")).add(\"0.059988401997829\").toString() == \"0.423324324993102\": " + ((new Decimal("0.363335922995273")).add("0.059988401997829").toString() == "0.423324324993102" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00727318812500368\")).div(\"0.00000066755024793909\").toString() == \"10895.34180753883154799935035\": " + ((new Decimal("0.00727318812500368")).div("0.00000066755024793909").toString() == "10895.34180753883154799935035" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00994605123994223\")).mul(\"340674.865218194\").toString() == \"3388.369665620570517296904933\": " + ((new Decimal("0.00994605123994223")).mul("340674.865218194").toString() == "3388.369665620570517296904933" ? "OK" : "FAILED"));
console.log("(new Decimal(\"545.87652978761\")).div(\"38459.5745887885\").toString() == \"0.0141935145051432937033685765\": " + ((new Decimal("545.87652978761")).div("38459.5745887885").toString() == "0.0141935145051432937033685765" ? "OK" : "FAILED"));
console.log("(new Decimal(\"73907.2872204274\")).div(\"948164.853708895\").toString() == \"0.0779477186180520150647853816\": " + ((new Decimal("73907.2872204274")).div("948164.853708895").toString() == "0.0779477186180520150647853816" ? "OK" : "FAILED"));
console.log("(new Decimal(\"21.7019301008908\")).sub(\"561601.329856367\").toString() == \"-561579.6279262661092\": " + ((new Decimal("21.7019301008908")).sub("561601.329856367").toString() == "-561579.6279262661092" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000077988295712503\")).div(\"0.0838655958342671\").toString() == \"0.000009299200099480762053694\": " + ((new Decimal("0.00000077988295712503")).div("0.0838655958342671").toString() == "0.000009299200099480762053694" ? "OK" : "FAILED"));
console.log("(new Decimal(\"63.5544158814263\")).div(\"5282.37883247546\").toString() == \"0.0120314006051025781992414906\": " + ((new Decimal("63.5544158814263")).div("5282.37883247546").toString() == "0.0120314006051025781992414906" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3.61511963587958\")).sub(\"0.0000007097004403871\").toString() == \"3.6151189261791396129\": " + ((new Decimal("3.61511963587958")).sub("0.0000007097004403871").toString() == "3.6151189261791396129" ? "OK" : "FAILED"));
console.log("(new Decimal(\"466425.827921566\")).div(\"0.00000495051709699934\").toString() == \"94217597633.24137927210918575\": " + ((new Decimal("466425.827921566")).div("0.00000495051709699934").toString() == "94217597633.24137927210918575" ? "OK" : "FAILED"));
console.log("(new Decimal(\"706.5725502123\")).sub(\"0.926731790381825\").toString() == \"705.645818421918175\": " + ((new Decimal("706.5725502123")).sub("0.926731790381825").toString() == "705.645818421918175" ? "OK" : "FAILED"));
console.log("(new Decimal(\"528.77783893085\")).add(\"0.0682113917862118\").toString() == \"528.8460503226362118\": " + ((new Decimal("528.77783893085")).add("0.0682113917862118").toString() == "528.8460503226362118" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2587.55753868611\")).sub(\"0.00734292920555125\").toString() == \"2587.55019575690444875\": " + ((new Decimal("2587.55753868611")).sub("0.00734292920555125").toString() == "2587.55019575690444875" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8.61752288817313\")).mul(\"0.0000908951268488984\").toString() == \"0.000783290836043781952897929\": " + ((new Decimal("8.61752288817313")).mul("0.0000908951268488984").toString() == "0.000783290836043781952897929" ? "OK" : "FAILED"));
console.log("(new Decimal(\"91330.5146113646\")).sub(\"5942.35975572018\").toString() == \"85388.15485564442\": " + ((new Decimal("91330.5146113646")).sub("5942.35975572018").toString() == "85388.15485564442" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00754608521589361\")).mul(\"0.0795793500168153\").toString() == \"0.0006005125566523128396843158\": " + ((new Decimal("0.00754608521589361")).mul("0.0795793500168153").toString() == "0.0006005125566523128396843158" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1020.19813424917\")).add(\"0.0000381284709731715\").toString() == \"1020.1981723776409731715\": " + ((new Decimal("1020.19813424917")).add("0.0000381284709731715").toString() == "1020.1981723776409731715" ? "OK" : "FAILED"));
console.log("(new Decimal(\"874.749045295058\")).div(\"341990.017957049\").toString() == \"0.0025578204022461232891799586\": " + ((new Decimal("874.749045295058")).div("341990.017957049").toString() == "0.0025578204022461232891799586" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0945538378295274\")).add(\"1191.06811992408\").toString() == \"1191.1626737619095274\": " + ((new Decimal("0.0945538378295274")).add("1191.06811992408").toString() == "1191.1626737619095274" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00174284968606329\")).mul(\"0.000730060132560348\").toString() == \"0.0000012723850728401263936405\": " + ((new Decimal("0.00174284968606329")).mul("0.000730060132560348").toString() == "0.0000012723850728401263936405" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000886363427101804\")).div(\"0.000228553454963748\").toString() == \"0.3878144949689754244652101063\": " + ((new Decimal("0.0000886363427101804")).div("0.000228553454963748").toString() == "0.3878144949689754244652101063" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0088596635353098\")).div(\"0.0141155084195153\").toString() == \"0.6276545818966699448042492771\": " + ((new Decimal("0.0088596635353098")).div("0.0141155084195153").toString() == "0.6276545818966699448042492771" ? "OK" : "FAILED"));
console.log("(new Decimal(\"887642.763968391\")).sub(\"0.000230769643667512\").toString() == \"887642.763737621356332488\": " + ((new Decimal("887642.763968391")).sub("0.000230769643667512").toString() == "887642.763737621356332488" ? "OK" : "FAILED"));
console.log("(new Decimal(\"23004.7123148128\")).div(\"0.0000507608143383455\").toString() == \"453198251.7355850699596267647\": " + ((new Decimal("23004.7123148128")).div("0.0000507608143383455").toString() == "453198251.7355850699596267647" ? "OK" : "FAILED"));
console.log("(new Decimal(\"83.7147017399383\")).sub(\"0.0000060055106906246\").toString() == \"83.7146957344276093754\": " + ((new Decimal("83.7147017399383")).sub("0.0000060055106906246").toString() == "83.7146957344276093754" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.66405350466448\")).add(\"82.9751780643012\").toString() == \"87.63923156896568\": " + ((new Decimal("4.66405350466448")).add("82.9751780643012").toString() == "87.63923156896568" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6808.9278446552\")).div(\"5.05174435444723\").toString() == \"1347.836978065024006220719243\": " + ((new Decimal("6808.9278446552")).div("5.05174435444723").toString() == "1347.836978065024006220719243" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8813.68504316252\")).div(\"0.0011427323572071\").toString() == \"7712816.555491301005803016359\": " + ((new Decimal("8813.68504316252")).div("0.0011427323572071").toString() == "7712816.555491301005803016359" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000007260315151541\")).mul(\"92078.4929730364\").toString() == \"0.0066851887766319767409290909\": " + ((new Decimal("0.00000007260315151541")).mul("92078.4929730364").toString() == "0.0066851887766319767409290909" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000009849602240068\")).div(\"8.11995554162187\").toString() == \"0.0000000121301184342453339116\": " + ((new Decimal("0.00000009849602240068")).div("8.11995554162187").toString() == "0.0000000121301184342453339116" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.312526527006424\")).add(\"0.0000476625125611492\").toString() == \"0.3125741895189851492\": " + ((new Decimal("0.312526527006424")).add("0.0000476625125611492").toString() == "0.3125741895189851492" ? "OK" : "FAILED"));
console.log("(new Decimal(\"18502.905787203\")).div(\"90759.3578522836\").toString() == \"0.2038677468092889069882980431\": " + ((new Decimal("18502.905787203")).div("90759.3578522836").toString() == "0.2038677468092889069882980431" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000294573398909799\")).div(\"5298.63346614811\").toString() == \"0.0000000005559422081028409448\": " + ((new Decimal("0.00000294573398909799")).div("5298.63346614811").toString() == "0.0000000005559422081028409448" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3090023.14838116\")).div(\"0.066578879657471\").toString() == \"46411462.07744004846467021314\": " + ((new Decimal("3090023.14838116")).div("0.066578879657471").toString() == "46411462.07744004846467021314" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000043088218729519\")).div(\"0.166889719742765\").toString() == \"0.000002581837802588014691071\": " + ((new Decimal("0.00000043088218729519")).div("0.166889719742765").toString() == "0.000002581837802588014691071" ? "OK" : "FAILED"));
console.log("(new Decimal(\"662563.871900814\")).sub(\"0.00191824029289104\").toString() == \"662563.86998257370710896\": " + ((new Decimal("662563.871900814")).sub("0.00191824029289104").toString() == "662563.86998257370710896" ? "OK" : "FAILED"));
console.log("(new Decimal(\"4.09383642677862\")).sub(\"0.000295314708862135\").toString() == \"4.093541112069757865\": " + ((new Decimal("4.09383642677862")).sub("0.000295314708862135").toString() == "4.093541112069757865" ? "OK" : "FAILED"));
console.log("(new Decimal(\"17.4083959392311\")).mul(\"0.00298270072461232\").toString() == \"0.0519240351822827709748263872\": " + ((new Decimal("17.4083959392311")).mul("0.00298270072461232").toString() == "0.0519240351822827709748263872" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1775.79848178467\")).div(\"0.00000003136671121762\").toString() == \"56614111357.23815883781477356\": " + ((new Decimal("1775.79848178467")).div("0.00000003136671121762").toString() == "56614111357.23815883781477356" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000057644597700632\")).add(\"0.180472625969198\").toString() == \"0.18047320241517500632\": " + ((new Decimal("0.00000057644597700632")).add("0.180472625969198").toString() == "0.18047320241517500632" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000002374956338841\")).sub(\"0.00000038625280064822\").toString() == \"-0.00000014875716676412\": " + ((new Decimal("0.0000002374956338841")).sub("0.00000038625280064822").toString() == "-0.00000014875716676412" ? "OK" : "FAILED"));
console.log("(new Decimal(\"222.322416595333\")).div(\"0.00000949221633816707\").toString() == \"23421549.68607290097499964928\": " + ((new Decimal("222.322416595333")).div("0.00000949221633816707").toString() == "23421549.68607290097499964928" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0221267636037091\")).div(\"0.00571593926088695\").toString() == \"3.871063458479728538175789638\": " + ((new Decimal("0.0221267636037091")).div("0.00571593926088695").toString() == "3.871063458479728538175789638" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7016.24042681243\")).mul(\"2.31098136040893\").toString() == \"16214.400846511121144041207\": " + ((new Decimal("7016.24042681243")).mul("2.31098136040893").toString() == "16214.400846511121144041207" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0681883810871227\")).mul(\"0.0285837007353938\").toString() == \"0.0019490762786253018034972934\": " + ((new Decimal("0.0681883810871227")).mul("0.0285837007353938").toString() == "0.0019490762786253018034972934" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.85837511246017\")).add(\"0.298812468675344\").toString() == \"1.157187581135514\": " + ((new Decimal("0.85837511246017")).add("0.298812468675344").toString() == "1.157187581135514" ? "OK" : "FAILED"));
console.log("(new Decimal(\"193.647991956048\")).sub(\"5115487.51737712\").toString() == \"-5115293.869385163952\": " + ((new Decimal("193.647991956048")).sub("5115487.51737712").toString() == "-5115293.869385163952" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0550483308988848\")).add(\"0.00000000463531906932\").toString() == \"0.05504833553420386932\": " + ((new Decimal("0.0550483308988848")).add("0.00000000463531906932").toString() == "0.05504833553420386932" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000007991035286333\")).mul(\"28294.9331813934\").toString() == \"0.0226105809476949110796916402\": " + ((new Decimal("0.0000007991035286333")).mul("28294.9331813934").toString() == "0.0226105809476949110796916402" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000001163869482076\")).div(\"0.000270252914293787\").toString() == \"0.0000430659364069161812657506\": " + ((new Decimal("0.00000001163869482076")).div("0.000270252914293787").toString() == "0.0000430659364069161812657506" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.882389189620684\")).add(\"369.017363697764\").toString() == \"369.899752887384684\": " + ((new Decimal("0.882389189620684")).add("369.017363697764").toString() == "369.899752887384684" ? "OK" : "FAILED"));
console.log("(new Decimal(\"826.882673346848\")).sub(\"6.52467805264735\").toString() == \"820.35799529420065\": " + ((new Decimal("826.882673346848")).sub("6.52467805264735").toString() == "820.35799529420065" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.916831304746136\")).add(\"8664.32508857191\").toString() == \"8665.241919876656136\": " + ((new Decimal("0.916831304746136")).add("8664.32508857191").toString() == "8665.241919876656136" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3431.67145430654\")).mul(\"324417.975416602\").toString() == \"1113295905.501073927263513177\": " + ((new Decimal("3431.67145430654")).mul("324417.975416602").toString() == "1113295905.501073927263513177" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7011684.364179\")).div(\"0.80641197962985\").toString() == \"8694915.925476979062011583459\": " + ((new Decimal("7011684.364179")).div("0.80641197962985").toString() == "8694915.925476979062011583459" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000716280695384499\")).mul(\"41056.2735707761\").toString() == \"2.940781618317173272907933967\": " + ((new Decimal("0.0000716280695384499")).mul("41056.2735707761").toString() == "2.940781618317173272907933967" ? "OK" : "FAILED"));
console.log("(new Decimal(\"80.8113612145238\")).div(\"716.453557236331\").toString() == \"0.1127935794278807392120038243\": " + ((new Decimal("80.8113612145238")).div("716.453557236331").toString() == "0.1127935794278807392120038243" ? "OK" : "FAILED"));
console.log("(new Decimal(\"721.107919570575\")).div(\"0.0000080546909421937\").toString() == \"89526454.18002603306158347663\": " + ((new Decimal("721.107919570575")).div("0.0000080546909421937").toString() == "89526454.18002603306158347663" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000087664416240372\")).sub(\"0.00000488921517733914\").toString() == \"-0.00000401257101493542\": " + ((new Decimal("0.00000087664416240372")).sub("0.00000488921517733914").toString() == "-0.00000401257101493542" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2861249.48079756\")).mul(\"0.49080289690327\").toString() == \"1404309.533938419656253772021\": " + ((new Decimal("2861249.48079756")).mul("0.49080289690327").toString() == "1404309.533938419656253772021" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.329140784372175\")).mul(\"35.8494064471914\").toString() == \"11.7995017573054848385410593\": " + ((new Decimal("0.329140784372175")).mul("35.8494064471914").toString() == "11.7995017573054848385410593" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.887126708350669\")).add(\"85.6919240605514\").toString() == \"86.579050768902069\": " + ((new Decimal("0.887126708350669")).add("85.6919240605514").toString() == "86.579050768902069" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005458257806235\")).div(\"8255.84495358907\").toString() == \"0.0000000000066113860385206571\": " + ((new Decimal("0.00000005458257806235")).div("8255.84495358907").toString() == "0.0000000000066113860385206571" ? "OK" : "FAILED"));
console.log("(new Decimal(\"265.788107768534\")).sub(\"0.00000018528184443027\").toString() == \"265.78810758325215556973\": " + ((new Decimal("265.788107768534")).sub("0.00000018528184443027").toString() == "265.78810758325215556973" ? "OK" : "FAILED"));
console.log("(new Decimal(\"668461.556857667\")).div(\"0.00000001834796551538\").toString() == \"36432462024050.33593888683916\": " + ((new Decimal("668461.556857667")).div("0.00000001834796551538").toString() == "36432462024050.33593888683916" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.634302762632399\")).sub(\"0.0000669526177304576\").toString() == \"0.6342358100146685424\": " + ((new Decimal("0.634302762632399")).sub("0.0000669526177304576").toString() == "0.6342358100146685424" ? "OK" : "FAILED"));
console.log("(new Decimal(\"1.00043254485374\")).add(\"0.926340501721176\").toString() == \"1.926773046574916\": " + ((new Decimal("1.00043254485374")).add("0.926340501721176").toString() == "1.926773046574916" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000329803545647209\")).sub(\"1041.94304023029\").toString() == \"-1041.94303693225454352791\": " + ((new Decimal("0.00000329803545647209")).sub("1041.94304023029").toString() == "-1041.94303693225454352791" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0218895030309863\")).add(\"1.71017506239478\").toString() == \"1.7320645654257663\": " + ((new Decimal("0.0218895030309863")).add("1.71017506239478").toString() == "1.7320645654257663" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000850892723934209\")).mul(\"739603.456919828\").toString() == \"6.293232000896698454972595961\": " + ((new Decimal("0.00000850892723934209")).mul("739603.456919828").toString() == "6.293232000896698454972595961" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5.53383796733517\")).sub(\"41976.4381563181\").toString() == \"-41970.90431835076483\": " + ((new Decimal("5.53383796733517")).sub("41976.4381563181").toString() == "-41970.90431835076483" ? "OK" : "FAILED"));
console.log("(new Decimal(\"428.763072671724\")).sub(\"3233793.77053762\").toString() == \"-3233365.007464948276\": " + ((new Decimal("428.763072671724")).sub("3233793.77053762").toString() == "-3233365.007464948276" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000003885374662413\")).mul(\"6.3094606559302\").toString() == \"0.0000002451461856604290637149\": " + ((new Decimal("0.00000003885374662413")).mul("6.3094606559302").toString() == "0.0000002451461856604290637149" ? "OK" : "FAILED"));
console.log("(new Decimal(\"948527.350532137\")).div(\"0.0327841969825254\").toString() == \"28932456.42215119995144378124\": " + ((new Decimal("948527.350532137")).div("0.0327841969825254").toString() == "28932456.42215119995144378124" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000126452543831641\")).sub(\"39125.7888354015\").toString() == \"-39125.788708948956168359\": " + ((new Decimal("0.000126452543831641")).sub("39125.7888354015").toString() == "-39125.788708948956168359" ? "OK" : "FAILED"));
console.log("(new Decimal(\"228915.375763977\")).mul(\"0.00000588367115514524\").toString() == \"1.346862793351745232159395019\": " + ((new Decimal("228915.375763977")).mul("0.00000588367115514524").toString() == "1.346862793351745232159395019" ? "OK" : "FAILED"));
console.log("(new Decimal(\"49193.1172782523\")).mul(\"798.428482747836\").toString() == \"39277185.99011133955490768702\": " + ((new Decimal("49193.1172782523")).mul("798.428482747836").toString() == "39277185.99011133955490768702" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000052592187771849\")).mul(\"0.00000011057982459226\").toString() == \"0.0000000000000581563489873426\": " + ((new Decimal("0.00000052592187771849")).mul("0.00000011057982459226").toString() == "0.0000000000000581563489873426" ? "OK" : "FAILED"));
console.log("(new Decimal(\"61797.5818746712\")).add(\"0.0126237813442125\").toString() == \"61797.5944984525442125\": " + ((new Decimal("61797.5818746712")).add("0.0126237813442125").toString() == "61797.5944984525442125" ? "OK" : "FAILED"));
console.log("(new Decimal(\"198087.806439999\")).sub(\"63.660917274496\").toString() == \"198024.145522724504\": " + ((new Decimal("198087.806439999")).sub("63.660917274496").toString() == "198024.145522724504" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000982426096677047\")).sub(\"3200.88941752952\").toString() == \"-3200.88940770525903322953\": " + ((new Decimal("0.00000982426096677047")).sub("3200.88941752952").toString() == "-3200.88940770525903322953" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000242386010122665\")).add(\"5.67620896532955\").toString() == \"5.676451351339672665\": " + ((new Decimal("0.000242386010122665")).add("5.67620896532955").toString() == "5.676451351339672665" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000055833457250071\")).mul(\"0.139157413569818\").toString() == \"0.0000000776963950158088336964\": " + ((new Decimal("0.00000055833457250071")).mul("0.139157413569818").toString() == "0.0000000776963950158088336964" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000561036967933661\")).div(\"0.0000000958356687314\").toString() == \"5854.156133726027806189896465\": " + ((new Decimal("0.000561036967933661")).div("0.0000000958356687314").toString() == "5854.156133726027806189896465" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000084970553864246\")).div(\"25886.2516963325\").toString() == \"0.0000000000328245876850082616\": " + ((new Decimal("0.00000084970553864246")).div("25886.2516963325").toString() == "0.0000000000328245876850082616" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000315344957781651\")).add(\"98.5771398519059\").toString() == \"98.5771713864016781651\": " + ((new Decimal("0.0000315344957781651")).add("98.5771398519059").toString() == "98.5771713864016781651" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.355002424845007\")).div(\"0.0000941781926407377\").toString() == \"3769.475872182401839401990908\": " + ((new Decimal("0.355002424845007")).div("0.0000941781926407377").toString() == "3769.475872182401839401990908" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.347713165147096\")).sub(\"0.00537833320227374\").toString() == \"0.34233483194482226\": " + ((new Decimal("0.347713165147096")).sub("0.00537833320227374").toString() == "0.34233483194482226" ? "OK" : "FAILED"));
console.log("(new Decimal(\"2450696.35214782\")).add(\"0.523734523227315\").toString() == \"2450696.875882343227315\": " + ((new Decimal("2450696.35214782")).add("0.523734523227315").toString() == "2450696.875882343227315" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000050161292520427\")).div(\"64021.2495643744\").toString() == \"0.0000000000078351005114308196\": " + ((new Decimal("0.00000050161292520427")).div("64021.2495643744").toString() == "0.0000000000078351005114308196" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000091908279104116\")).sub(\"6281.22716968936\").toString() == \"-6281.22716877027720895884\": " + ((new Decimal("0.00000091908279104116")).sub("6281.22716968936").toString() == "-6281.22716877027720895884" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000851479899069052\")).add(\"0.0518550245332788\").toString() == \"0.0519401725231857052\": " + ((new Decimal("0.0000851479899069052")).add("0.0518550245332788").toString() == "0.0519401725231857052" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000002975221119344\")).add(\"0.0000913565217942728\").toString() == \"0.00009138627400546624\": " + ((new Decimal("0.00000002975221119344")).add("0.0000913565217942728").toString() == "0.00009138627400546624" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000086909218266098\")).div(\"0.00000937361546762922\").toString() == \"0.0927168588963668332272999205\": " + ((new Decimal("0.00000086909218266098")).div("0.00000937361546762922").toString() == "0.0927168588963668332272999205" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7678.32436025065\")).mul(\"5281.53319157731\").toString() == \"40553324.96436042249074045275\": " + ((new Decimal("7678.32436025065")).mul("5281.53319157731").toString() == "40553324.96436042249074045275" ? "OK" : "FAILED"));
console.log("(new Decimal(\"8581024.56600453\")).sub(\"0.000748217636602101\").toString() == \"8581024.565256312363397899\": " + ((new Decimal("8581024.56600453")).sub("0.000748217636602101").toString() == "8581024.565256312363397899" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000244098234104038\")).mul(\"1413.21876617764\").toString() == \"0.034496420522664930828334931\": " + ((new Decimal("0.0000244098234104038")).mul("1413.21876617764").toString() == "0.034496420522664930828334931" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000002482942213529\")).sub(\"0.00144902275942686\").toString() == \"-0.00144899793000472471\": " + ((new Decimal("0.00000002482942213529")).sub("0.00144902275942686").toString() == "-0.00144899793000472471" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000910689151338623\")).div(\"0.0624483139079289\").toString() == \"0.0145830863052812570331711621\": " + ((new Decimal("0.000910689151338623")).div("0.0624483139079289").toString() == "0.0145830863052812570331711621" ? "OK" : "FAILED"));
console.log("(new Decimal(\"131248.713532113\")).sub(\"0.029189164670738\").toString() == \"131248.684342948329262\": " + ((new Decimal("131248.713532113")).sub("0.029189164670738").toString() == "131248.684342948329262" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000344105692274918\")).add(\"5019.00342992461\").toString() == \"5019.003774030302274918\": " + ((new Decimal("0.000344105692274918")).add("5019.00342992461").toString() == "5019.003774030302274918" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000617910423603798\")).div(\"8647058.96407695\").toString() == \"0.0000000000714590274185505401\": " + ((new Decimal("0.000617910423603798")).div("8647058.96407695").toString() == "0.0000000000714590274185505401" ? "OK" : "FAILED"));
console.log("(new Decimal(\"890433.234577269\")).sub(\"0.00000218624474116892\").toString() == \"890433.23457508275525883108\": " + ((new Decimal("890433.234577269")).sub("0.00000218624474116892").toString() == "890433.23457508275525883108" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7.7632498637602\")).div(\"1785923.30393657\").toString() == \"0.0000043469111168706293851817\": " + ((new Decimal("7.7632498637602")).div("1785923.30393657").toString() == "0.0000043469111168706293851817" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5613.03226538609\")).mul(\"0.00000005870455790251\").toString() == \"0.0003295105776320145972457301\": " + ((new Decimal("5613.03226538609")).mul("0.00000005870455790251").toString() == "0.0003295105776320145972457301" ? "OK" : "FAILED"));
console.log("(new Decimal(\"6769137.76284509\")).add(\"12.7702162194858\").toString() == \"6769150.5330613094858\": " + ((new Decimal("6769137.76284509")).add("12.7702162194858").toString() == "6769150.5330613094858" ? "OK" : "FAILED"));
console.log("(new Decimal(\"987.946705887069\")).add(\"3244819.74506975\").toString() == \"3245807.691775637069\": " + ((new Decimal("987.946705887069")).add("3244819.74506975").toString() == "3245807.691775637069" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000970930446391427\")).add(\"373.655598318975\").toString() == \"373.6556954120196391427\": " + ((new Decimal("0.0000970930446391427")).add("373.655598318975").toString() == "373.6556954120196391427" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000085500743326499\")).sub(\"0.0206125082078448\").toString() == \"-0.02061165320041153501\": " + ((new Decimal("0.00000085500743326499")).sub("0.0206125082078448").toString() == "-0.02061165320041153501" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000001982638995155\")).mul(\"43.9281180239879\").toString() == \"0.0000008709359977812961424188\": " + ((new Decimal("0.00000001982638995155")).mul("43.9281180239879").toString() == "0.0000008709359977812961424188" ? "OK" : "FAILED"));
console.log("(new Decimal(\"544246.617026742\")).add(\"0.00308342991540368\").toString() == \"544246.62011017191540368\": " + ((new Decimal("544246.617026742")).add("0.00308342991540368").toString() == "544246.62011017191540368" ? "OK" : "FAILED"));
console.log("(new Decimal(\"51.7331402989724\")).sub(\"0.00000045465710547504\").toString() == \"51.73313984431529452496\": " + ((new Decimal("51.7331402989724")).sub("0.00000045465710547504").toString() == "51.73313984431529452496" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000107662315064884\")).div(\"2325377.89378566\").toString() == \"0.000000000046298846889617716\": " + ((new Decimal("0.000107662315064884")).div("2325377.89378566").toString() == "0.000000000046298846889617716" ? "OK" : "FAILED"));
console.log("(new Decimal(\"18572.0885258969\")).add(\"0.0000262804395175914\").toString() == \"18572.0885521773395175914\": " + ((new Decimal("18572.0885258969")).add("0.0000262804395175914").toString() == "18572.0885521773395175914" ? "OK" : "FAILED"));
console.log("(new Decimal(\"5.44742788907486\")).mul(\"0.00000050541048520497\").toString() == \"0.0000027531871725364104883308\": " + ((new Decimal("5.44742788907486")).mul("0.00000050541048520497").toString() == "0.0000027531871725364104883308" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00937844566506261\")).sub(\"12716.2845864502\").toString() == \"-12716.27520800453493739\": " + ((new Decimal("0.00937844566506261")).sub("12716.2845864502").toString() == "-12716.27520800453493739" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000613210929377568\")).mul(\"0.00000050357599160801\").toString() == \"0.0000000003087983018261781959\": " + ((new Decimal("0.000613210929377568")).mul("0.00000050357599160801").toString() == "0.0000000003087983018261781959" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9.79164098845406\")).div(\"0.095687663506571\").toString() == \"102.3291888382419840374084578\": " + ((new Decimal("9.79164098845406")).div("0.095687663506571").toString() == "102.3291888382419840374084578" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3509.39318701131\")).mul(\"2.82903096304696\").toString() == \"9928.181987561046525253581118\": " + ((new Decimal("3509.39318701131")).mul("2.82903096304696").toString() == "9928.181987561046525253581118" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00550658921501906\")).add(\"0.000255294594101279\").toString() == \"0.005761883809120339\": " + ((new Decimal("0.00550658921501906")).add("0.000255294594101279").toString() == "0.005761883809120339" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000003774064715846\")).sub(\"0.0000002250096677919\").toString() == \"-0.00000018726902063344\": " + ((new Decimal("0.00000003774064715846")).sub("0.0000002250096677919").toString() == "-0.00000018726902063344" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000982163002706209\")).mul(\"0.0179801769638342\").toString() == \"0.0000176594645959884060957208\": " + ((new Decimal("0.000982163002706209")).mul("0.0179801769638342").toString() == "0.0000176594645959884060957208" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000156584160940994\")).sub(\"0.605677767473123\").toString() == \"-0.60567620163151359006\": " + ((new Decimal("0.00000156584160940994")).sub("0.605677767473123").toString() == "-0.60567620163151359006" ? "OK" : "FAILED"));
console.log("(new Decimal(\"83.8072135037776\")).sub(\"14461.6299376179\").toString() == \"-14377.8227241141224\": " + ((new Decimal("83.8072135037776")).sub("14461.6299376179").toString() == "-14377.8227241141224" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005587505207205\")).add(\"82431.571922466\").toString() == \"82431.57192252187505207205\": " + ((new Decimal("0.00000005587505207205")).add("82431.571922466").toString() == "82431.57192252187505207205" ? "OK" : "FAILED"));
console.log("(new Decimal(\"7479600.39762761\")).sub(\"9.39890955081159\").toString() == \"7479590.99871805918841\": " + ((new Decimal("7479600.39762761")).sub("9.39890955081159").toString() == "7479590.99871805918841" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000060434978762844\")).add(\"0.853000997962896\").toString() == \"0.85300160231268362844\": " + ((new Decimal("0.00000060434978762844")).add("0.853000997962896").toString() == "0.85300160231268362844" ? "OK" : "FAILED"));
console.log("(new Decimal(\"56119.2728374709\")).sub(\"0.00000042419260992864\").toString() == \"56119.27283704670739007136\": " + ((new Decimal("56119.2728374709")).sub("0.00000042419260992864").toString() == "56119.27283704670739007136" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008143559702739\")).mul(\"0.000527115862130707\").toString() == \"0.00000000004292599493522152\": " + ((new Decimal("0.00000008143559702739")).mul("0.000527115862130707").toString() == "0.00000000004292599493522152" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.177999768954702\")).div(\"805.361523667984\").toString() == \"0.0002210184665192469105090427\": " + ((new Decimal("0.177999768954702")).div("805.361523667984").toString() == "0.0002210184665192469105090427" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000008959675058238\")).add(\"402.380516008651\").toString() == \"402.38051609824775058238\": " + ((new Decimal("0.00000008959675058238")).add("402.380516008651").toString() == "402.38051609824775058238" ? "OK" : "FAILED"));
console.log("(new Decimal(\"3201536.39800918\")).mul(\"0.000361677474045045\").toString() == \"1157.923597495232058259643513\": " + ((new Decimal("3201536.39800918")).mul("0.000361677474045045").toString() == "1157.923597495232058259643513" ? "OK" : "FAILED"));
console.log("(new Decimal(\"9903407.65095475\")).mul(\"60191.9469238221\").toString() == \"596105387691.24201370458415\": " + ((new Decimal("9903407.65095475")).mul("60191.9469238221").toString() == "596105387691.24201370458415" ? "OK" : "FAILED"));
console.log("(new Decimal(\"293261.767501599\")).sub(\"134104.901055854\").toString() == \"159156.866445745\": " + ((new Decimal("293261.767501599")).sub("134104.901055854").toString() == "159156.866445745" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0000990216107103143\")).div(\"0.000000003885781208\").toString() == \"25483.06387051586667717499549\": " + ((new Decimal("0.0000990216107103143")).div("0.000000003885781208").toString() == "25483.06387051586667717499549" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.504111655756883\")).mul(\"542.411204214399\").toString() == \"273.4358102576054741997519583\": " + ((new Decimal("0.504111655756883")).mul("542.411204214399").toString() == "273.4358102576054741997519583" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000002588138930773\")).mul(\"212.443559995128\").toString() == \"0.0000054983344821540025900927\": " + ((new Decimal("0.00000002588138930773")).mul("212.443559995128").toString() == "0.0000054983344821540025900927" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000005520699944124\")).div(\"0.00000137589670781786\").toString() == \"0.0401243778893816891004378948\": " + ((new Decimal("0.00000005520699944124")).div("0.00000137589670781786").toString() == "0.0401243778893816891004378948" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.000056398253821022\")).add(\"0.00000009276926801203\").toString() == \"0.00005649102308903403\": " + ((new Decimal("0.000056398253821022")).add("0.00000009276926801203").toString() == "0.00005649102308903403" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0854362290750426\")).div(\"0.0000701704876824145\").toString() == \"1217.552163264412705045034618\": " + ((new Decimal("0.0854362290750426")).div("0.0000701704876824145").toString() == "1217.552163264412705045034618" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000001968172030509\")).div(\"8890.12679405982\").toString() == \"0.0000000000022138852190770639\": " + ((new Decimal("0.00000001968172030509")).div("8890.12679405982").toString() == "0.0000000000022138852190770639" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000665923518438788\")).add(\"0.0000363822408189914\").toString() == \"0.00004304147600337928\": " + ((new Decimal("0.00000665923518438788")).add("0.0000363822408189914").toString() == "0.00004304147600337928" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.846703634525977\")).add(\"0.00000067634504925289\").toString() == \"0.84670431087102625289\": " + ((new Decimal("0.846703634525977")).add("0.00000067634504925289").toString() == "0.84670431087102625289" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.0963102136721417\")).sub(\"0.000920004674661907\").toString() == \"0.095390208997479793\": " + ((new Decimal("0.0963102136721417")).sub("0.000920004674661907").toString() == "0.095390208997479793" ? "OK" : "FAILED"));
console.log("(new Decimal(\"0.00000990941151041045\")).sub(\"0.00982685674439504\").toString() == \"-0.00981694733288462955\": " + ((new Decimal("0.00000990941151041045")).sub("0.00982685674439504").toString() == "-0.00981694733288462955" ? "OK" : "FAILED"));
