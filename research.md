---
title: Research
description: Automated acquisition and analysis for STEM, statistically representative microscopy, and nanoscale structure in energy materials.
---

# Research

Our work covers three connected areas. The first is automation of the
acquisition and analysis chain for scanning transmission electron microscopy
(STEM), so that a measurement can be planned, executed, and reduced without
manual intervention at each step. The second is the use of that automation to
make microscopy results statistically representative of the specimen rather
than of one selected region. The third applies both to materials that store and
convert energy, where the properties of interest are controlled by minority
populations that bulk measurements average away.

:::{anywidget} ./widgets/research-themes.js
{"mode": "row"}
:::

## Automated acquisition and analysis for STEM

:::{anywidget} ./widgets/research-themes.js
{"mode": "scan"}
:::

A scanning electron nanobeam diffraction (SEND) experiment records a full
diffraction pattern at every probe position, so the choice of scan parameters
determines the data volume and the acquisition time as directly as it
determines the spatial sampling. A scan of 500 by 500 positions with a 256 by
256 pixel detector and 16 bit depth produces roughly 33 GB of raw data, which
must be written, transferred, and reduced within the same session in which it
was collected. Scan design is therefore part of experimental design, not a
detail settled at the console.

We have built an interactive routine that controls SEND and ptychography
acquisition from a script and passes the data directly to analysis, described
in [](https://doi.org/10.48550/arXiv.2608.13752). The routine coordinates the
detector, the stage, and the reduction step, and it writes the acquisition
metadata needed to interpret the data after the session has ended. The
practical benefit is coverage: a scripted routine can survey many regions of a
specimen in the time an operator surveys a few, and it records the same
parameters in each one.

The step size sets the smallest feature a scan can sample, and it also sets the
number of patterns, the data volume, and the total scan time, all of which scale
as the inverse square of the step. Choosing it well is most of what scan design
consists of.

We also require automation for low-dose experiments, because a beam-sensitive
specimen tolerates a limited electron fluence and the experiment must therefore
succeed on the first attempt. Collecting diffraction and X-ray spectra
simultaneously uses that fluence once rather than twice.
[](https://doi.org/10.1002/adma.74382) applied concurrent 4D-STEM and XEDS
mapping to lead halide perovskites at doses those materials survive, and
[](https://doi.org/10.48550/arXiv.2606.12029) followed the dehydration pathway
of theophylline, a model channel hydrate, in situ.

We apply the same scrutiny to reconstruction methods.
[](https://doi.org/10.1063/5.0143684) demonstrated electron ptychography of
low-dimensional materials at 30 keV with a resolution beyond the sampling limit
of the detector. However, an automated pipeline must also identify
reconstructions that cannot be trusted.
[](https://doi.org/10.48550/arXiv.2608.30359) showed that sufficient real-space
probe overlap does not by itself guarantee a unique solution in nanobeam
iterative ptychography, an ambiguity that unattended processing would otherwise
report as a result.

## Statistically representative microscopy

:::{anywidget} ./widgets/research-themes.js
{"mode": "sampling"}
:::

A conventional micrograph images a region of order one millionth of the
specimen area, selected by an operator who was looking for a feature of
interest. Quantities measured from that region describe the region. Whether
they describe the material depends on how the region was chosen and on how the
microstructure varies, and both conditions are usually left unstated.

We use SEND to sample many regions quickly, and unsupervised methods then group
the resulting patterns into domains without requiring the domains to be
specified in advance.
[](https://doi.org/10.1038/s41524-022-00960-y) used variational autoencoders to
map domains in SEND datasets, and
[](https://doi.org/10.1063/5.0246329) compared clustering workflows for
automated segmentation of analytical STEM data and identified which processing
choices change the segmentation that results.

Spatial correlation determines how many regions a measurement needs. A phase
dispersed uniformly can be estimated from a small number of fields of view,
while the same phase concentrated into colonies requires substantially more for
the same confidence interval, because the regions are no longer independent
samples. The number of regions required therefore depends on the microstructure
and not only on the precision wanted.

We apply this requirement most often to engineering alloys, where a claim about
a precipitate population or a boundary character distribution must hold across a
component rather than across one foil.
[](https://doi.org/10.1016/j.actamat.2015.10.006) measured the effect of boron
on grain boundary character in a polycrystalline superalloy,
[](https://doi.org/10.1080/14786435.2017.1410290) combined TEM and atom probe
tomography to characterise secondary carbides in M50 bearing steel,
[](https://doi.org/10.1016/j.msea.2023.145005) measured the elastic strain state
of nanotwins in TWIP steel, and
[](https://doi.org/10.1038/s43246-026-01096-y) determined how defects assist the
refinement of nanoscale alpha in titanium alloys. In each case the useful output
is a distribution with a stated uncertainty, which allows two specimens to be
compared.

## Nanoscale structure in energy materials

:::{anywidget} ./widgets/research-themes.js
{"mode": "materials"}
:::

Materials that store and convert energy are limited by local structure: a
minority phase at a grain boundary, a degraded particle surface, or a metal
cluster one atom larger than the active size. A bulk measurement reports the
mean composition and cannot resolve these populations, so two specimens with
different local structure can produce the same bulk result.

We have applied local mapping to photovoltaic perovskites, where the phase that
limits performance is a minority population. [](https://doi.org/10.1126/science.abl4890) showed that halide
perovskites with tilted octahedra suppress the local formation of
performance-limiting phases, and
[](https://doi.org/10.1039/d4ee03058c) found that cation heterogeneity produces
a methylformamidinium byproduct that inhibits formation of the delta phase. In
battery electrodes, [](https://doi.org/10.1016/j.matt.2024.06.023) determined
the cation ordering of the low-temperature niobium-rich phase in niobium
tungsten bronzes, which controls lithium transport and therefore the rate
capability of the anode.

Supported metal catalysts require local imaging because the active species are
frequently smaller than one nanometre, and we provide that imaging across a
range of catalyst systems.
[](https://doi.org/10.1038/s41467-020-17852-8) identified an atomic copper site
on ceria that adsorbs and activates molecular oxygen, and
[](https://doi.org/10.1002/ange.202008370) designed a surface ruthenium single
site for CO activation and followed its evolution.
[](https://doi.org/10.1126/science.adw2469) imaged gold species at an organic
liquid-solid interface at atomic resolution, and
[](https://doi.org/10.1002/adma.73454) observed directly how active sites form
in nanoclusters used for hydrogen production. The support controls where
clusters nucleate and how large they grow:
[](https://doi.org/10.1021/acsanm.6c00899) used functionalised metal-organic
frameworks to fix palladium speciation at the subnanometre scale,
[](https://doi.org/10.1039/d4cp02422b) measured how the number and type of
framework functionalities set cluster growth under nanoconfinement, and
[](https://doi.org/10.1002/advs.202508034) identified a binding site common to
single-layer metal cluster self-assembly. Applied work in this area includes
[](https://doi.org/10.1002/ange.202522937), which measured how metal-mediated
nitrogen doping of carbon supports increases hydrogen production from ammonia.

Hydrogen storage in magnesium hydrides is where this line of work began, and
the limiting factor there is also microstructural rather than chemical. We
measured the deformation twins and the partially dehydrogenated microstructure
of nanocrystalline MgH2 in
[](https://doi.org/10.1016/j.actamat.2010.01.055), and compared the
microstructure of TiF3-catalysed and uncatalysed MgH2 through hydrogen cycling
in [](https://doi.org/10.1016/j.actamat.2012.07.036). Both studies required
imaging structures that the electron beam itself degrades, which sets the dose
budget for the measurement. We extended the same approach to engineered
architectures in [](https://doi.org/10.1016/j.ijhydene.2010.12.006), which
measured hydrogen storage in Mg-Ti and Mg-stainless steel multilayers made by
accumulative roll bonding, and in
[](https://doi.org/10.1021/jp3085843), which used electron microscopy and
electron energy loss spectroscopy to follow the formation of the ternary
hydride Mg2FeH6 from MgH2 and iron.

The common question across these systems is the detection limit: how small a
minority population can be identified, and with what confidence, before it is
averaged into the mean. We stated that problem explicitly for cation ordering in
an A-site deficient perovskite in
[](https://doi.org/10.1021/acs.inorgchem.6b02087), using STEM imaging and EELS
to distinguish ordered domains that diffraction alone could not separate.
