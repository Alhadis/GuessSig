`guess-sig(1)`
==============

Forensics utility to help identify [file signatures][1] of undocumented and proprietary binary formats.

	guess-sig /path/to/files/*

Its output looks like this:

	FF D8 FF E0 00 10 4A 46 49 46 00 01 01 __ 00 __
	00 __ 00 00 FF __ 00 __ __ __ __ __ __ __ __ __

See the program's [manpage][2] for options and usage examples:

	man guess-sig

[Referenced links]: ____________________________________________________________
[1]: https://en.wikipedia.org/wiki/File_format#Magic_number
[2]: ./guess-sig.1
